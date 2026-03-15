const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CRED_API_BASE = "https://eutdgemlrpvnxfkkpvlu.supabase.co/functions/v1";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Decode a JWT payload without verification (verification is done by Supabase gateway). */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT");
  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(payload);
  return JSON.parse(decoded);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate the caller (Supabase JWT)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const CRED_API_KEY = Deno.env.get("CRED_API_KEY");
  if (!CRED_API_KEY) return json({ error: "CRED_API_KEY not configured" }, 500);

  // Decode JWT to extract user identity
  const token = authHeader.replace("Bearer ", "");
  let userId: string;
  let userEmail: string | undefined;
  try {
    const payload = decodeJwtPayload(token);
    userId = payload.sub as string;
    userEmail = payload.email as string | undefined;
  } catch {
    return json({ error: "Invalid token" }, 401);
  }

  if (!userId) return json({ error: "Token missing user ID" }, 401);

  // Extract the sub-path from the request URL
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/cred-proxy\/?/, "");
  const search = url.searchParams;

  // For balance requests, auto-inject user identity as query params
  if (path === "balance" && req.method === "GET") {
    if (!search.has("user_id") && !search.has("email")) {
      if (userEmail) search.set("email", userEmail);
      else search.set("user_id", userId);
    }
  }

  const queryString = search.toString();

  // Route checkout to the separate hosted-checkout function,
  // everything else goes to credits-api
  let targetUrl: string;
  if (path === "checkout" || path.startsWith("checkout/")) {
    const checkoutPath = path.replace(/^checkout\/?/, "");
    targetUrl = `${CRED_API_BASE}/hosted-checkout${checkoutPath ? `/${checkoutPath}` : ""}${queryString ? `?${queryString}` : ""}`;
  } else if (path === "presale-checkout" || path.startsWith("presale-checkout/")) {
    const presalePath = path.replace(/^presale-checkout\/?/, "");
    targetUrl = `${CRED_API_BASE}/presale-checkout${presalePath ? `/${presalePath}` : ""}${queryString ? `?${queryString}` : ""}`;
  } else {
    targetUrl = `${CRED_API_BASE}/credits-api/${path}${queryString ? `?${queryString}` : ""}`;
  }

  try {
    let body: string | undefined;
    if (req.method !== "GET" && req.method !== "HEAD") {
      const rawBody = await req.text();
      // For POST/PATCH requests, inject user identity into body if not present
      try {
        const parsed = rawBody ? JSON.parse(rawBody) : {};
        if (path === "users" && !parsed.external_id) {
          parsed.external_id = userId;
        }
        if (!parsed.user_id) parsed.user_id = userId;
        if (!parsed.user_email && userEmail) parsed.user_email = userEmail;
        if (!parsed.email && userEmail) parsed.email = userEmail;
        if (!parsed.name && userEmail) parsed.name = userEmail.split("@")[0];
        body = JSON.stringify(parsed);
      } catch {
        body = rawBody;
      }
    }

    console.log(`cred-proxy → ${req.method} ${targetUrl}`);

    const res = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CRED_API_KEY,
        "x-user-token": token,
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
