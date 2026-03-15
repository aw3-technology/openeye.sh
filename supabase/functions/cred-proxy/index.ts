const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate the caller
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const CRED_API_KEY = Deno.env.get("CRED_API_KEY");
  if (!CRED_API_KEY) return json({ error: "CRED_API_KEY not configured" }, 500);

  const CRED_API_URL = Deno.env.get("CRED_API_URL");
  if (!CRED_API_URL) return json({ error: "CRED_API_URL not configured" }, 500);

  const CRED_CREDIT_TYPE_ID = Deno.env.get("CRED_CREDIT_TYPE_ID");

  // Extract the sub-path from the request URL
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/cred-proxy\/?/, "");
  const search = url.search;

  // Map proxy paths to Cred API paths & build the target URL
  // The Cred API uses x-api-key for auth and identifies project by key
  const targetUrl = `${CRED_API_URL}/${path}${search}`;

  // Extract the user's Supabase JWT to identify the end-user
  const userToken = authHeader.replace("Bearer ", "");

  try {
    const body = req.method !== "GET" && req.method !== "HEAD"
      ? await req.text()
      : undefined;

    console.log(`cred-proxy → ${req.method} ${targetUrl}`);

    const res = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CRED_API_KEY,
        "x-user-token": userToken,
      },
      body,
    });

    const data = await res.text();
    console.log(`cred-proxy ← ${res.status} (${data.length} bytes) ${data.substring(0, 200)}`);

    // Validate that the upstream returned valid JSON before forwarding
    if (data) {
      try {
        JSON.parse(data);
      } catch {
        console.error("cred-proxy: upstream returned non-JSON:", data.substring(0, 500));
        return json({ error: "Upstream returned invalid response", status: res.status, preview: data.substring(0, 200) }, 502);
      }
    }

    return new Response(data || "{}", {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("cred-proxy error:", message);
    return json({ error: message }, 502);
  }
});
