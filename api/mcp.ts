/**
 * Remote MCP server at https://openeye.sh/mcp (vercel.json rewrites /mcp here;
 * /api/mcp also works). Streamable HTTP transport, stateless: every POST is a
 * JSON-RPC message answered with a JSON body, so there are no sessions and GET
 * (the optional server-to-client SSE stream) returns 405.
 *
 * Exposes the hosted tools of the local `openeye-mcp` server under the same
 * names. Images arrive as a URL or base64 instead of a local path. initialize,
 * tools/list and openeye_api_models need no key; the other tools need
 * `Authorization: Bearer oe_...` and are rate limited, charged and logged
 * exactly like /v1 (api/_lib/inference.ts), with endpoint /mcp/<tool>.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { isIP } from "node:net";
import { requireApiKey, type ApiKeyContext } from "./_lib/api-key-auth.js";
import { enforceRateLimit, logUsage, models, runDescribe, runDetect, usage, VLM_MODEL } from "./_lib/inference.js";
import { HttpError, readRawBody, sendJson } from "./_lib/http.js";

const SERVER_INFO = { name: "openeye", title: "OpenEye", version: "0.3.0", websiteUrl: "https://openeye.sh" };
// Newest first; we answer with the client's version when we support it.
const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const INSTRUCTIONS =
  "Hosted vision tools from OpenEye (https://openeye.sh). Pass images as a public http(s) image_url or as image_base64 (JPEG or PNG, under 4 MB). " +
  "openeye_api_models is free and needs no key; the other tools need an OpenEye API key sent as `Authorization: Bearer oe_...` " +
  "(create one at https://openeye.sh/dashboard/settings/api-keys) and detection costs 1 credit per call. " +
  "To run models locally instead, install the local server: uvx --from \"openeye-sh[mcp]\" openeye-mcp.";

/** Vercel caps request bodies at 4.5 MB; base64 inflates an image by a third. */
const MAX_BODY_BYTES = 4.5 * 1024 * 1024;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_FETCH_TIMEOUT_MS = 10_000;

const imageProps = {
  image_url: { type: "string", description: "Public http(s) URL of a JPEG or PNG image." },
  image_base64: { type: "string", description: "JPEG or PNG bytes, base64 encoded (a data: URL also works). Use instead of image_url." },
};

const TOOLS = [
  {
    name: "openeye_api_detect",
    title: "Detect objects",
    description:
      "Detect objects in an image with YOLOv8 on the hosted API. Returns labels, confidences and pixel bounding boxes for the 80 COCO classes. Costs 1 credit.",
    inputSchema: {
      type: "object",
      properties: {
        ...imageProps,
        confidence: { type: "number", minimum: 0, maximum: 1, default: 0.25, description: "Minimum confidence to keep a detection." },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "openeye_api_describe",
    title: "Describe a scene",
    description:
      "Describe an image or answer a question about it with a vision-language model on the hosted API. Costs 3 credits. Check openeye_api_models first: it fails while the model shows available: false.",
    inputSchema: {
      type: "object",
      properties: {
        ...imageProps,
        prompt: { type: "string", description: "Question or instruction about the image.", default: "Describe what you see in this image." },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  {
    name: "openeye_api_models",
    title: "List hosted models",
    description: "List the models on the hosted API with their task, credit cost and whether they are available. Free, no key needed.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: "openeye_api_usage",
    title: "Usage and credits",
    description: "Show your credit balance and hosted API usage (requests and credits by endpoint and day).",
    inputSchema: {
      type: "object",
      properties: { days: { type: "integer", minimum: 1, maximum: 365, default: 30, description: "How many days of history." } },
    },
    annotations: { readOnlyHint: true },
  },
];

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

type ToolArgs = Record<string, unknown>;

class RpcError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

/** Loopback, private, link-local and unique-local literals; hostnames that resolve there are not checked. */
function isPrivateHost(host: string) {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal")) return true;
  if (isIP(h) === 4) return /^(0|10|127|169\.254|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(h);
  if (isIP(h) === 6) return h === "::1" || h === "::" || /^(fc|fd|fe80)/.test(h) || h.startsWith("::ffff:");
  return false;
}

async function loadImage(args: ToolArgs): Promise<Buffer> {
  const { image_url, image_base64 } = args;
  if (typeof image_base64 === "string" && image_base64) {
    const bytes = Buffer.from(image_base64.replace(/^data:[^,]*,/, ""), "base64");
    if (bytes.length === 0) throw new HttpError(400, "image_base64 is empty or not base64");
    if (bytes.length > MAX_IMAGE_BYTES) throw new HttpError(413, "Image must be under 4 MB");
    return bytes;
  }
  if (typeof image_url !== "string" || !image_url) {
    throw new HttpError(400, "Pass image_url (public http(s) URL) or image_base64. This remote server can't read local files.");
  }
  let url: URL;
  try {
    url = new URL(image_url);
  } catch {
    throw new HttpError(400, "image_url is not a valid URL");
  }
  if (!/^https?:$/.test(url.protocol) || isPrivateHost(url.hostname)) {
    throw new HttpError(400, "image_url must be a public http(s) URL");
  }
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS), redirect: "follow" });
  } catch {
    throw new HttpError(400, `Couldn't fetch image_url (${url.host})`);
  }
  if (!res.ok) throw new HttpError(400, `Fetching image_url returned HTTP ${res.status}`);
  if (Number(res.headers.get("content-length")) > MAX_IMAGE_BYTES) throw new HttpError(413, "Image must be under 4 MB");
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_IMAGE_BYTES) throw new HttpError(413, "Image must be under 4 MB");
  return bytes;
}

async function callTool(req: IncomingMessage, name: string, args: ToolArgs) {
  if (name === "openeye_api_models") return models();
  const metered = name === "openeye_api_detect" ? "yolov8" : name === "openeye_api_describe" ? VLM_MODEL : null;
  if (!metered && name !== "openeye_api_usage") throw new RpcError(-32602, `Unknown tool: ${name}`);

  const ctx: ApiKeyContext = await requireApiKey(req);
  if (name === "openeye_api_usage") return usage(ctx, Number(args.days));

  const endpoint = name === "openeye_api_detect" ? "/mcp/detect" : "/mcp/describe";
  try {
    await enforceRateLimit(ctx);
    const image = await loadImage(args);
    return name === "openeye_api_detect"
      ? await runDetect(ctx, image, args.confidence === undefined ? 0.25 : Number(args.confidence), endpoint)
      : await runDescribe(ctx, image, typeof args.prompt === "string" ? args.prompt : undefined, endpoint);
  } catch (err) {
    // Failed calls are logged uncharged so they count toward the rate limit, as in /v1 (429s excepted).
    const status = err instanceof HttpError ? err.status : 500;
    if (status !== 429) await logUsage(ctx, endpoint, metered, 0, null, status);
    throw err;
  }
}

async function dispatch(req: IncomingMessage, msg: JsonRpcMessage): Promise<unknown> {
  const params = msg.params ?? {};
  switch (msg.method) {
    case "initialize": {
      const requested = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
      return {
        protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      };
    }
    case "ping":
      return {};
    case "tools/list":
      return { tools: TOOLS };
    case "tools/call": {
      const name = typeof params.name === "string" ? params.name : "";
      const args = (params.arguments ?? {}) as ToolArgs;
      try {
        const result = await callTool(req, name, args);
        const structured = Array.isArray(result) ? { models: result } : (result as Record<string, unknown>);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: structured };
      } catch (err) {
        if (err instanceof RpcError) throw err;
        // Tool failures go back to the model as results it can read and act on.
        let message = err instanceof HttpError ? err.message : "Internal error";
        if (err instanceof HttpError && err.status === 401) {
          message += " Create a key at https://openeye.sh/dashboard/settings/api-keys and add it to this server's headers in your MCP client config.";
        }
        if (!(err instanceof HttpError)) console.error("[api/mcp]", err);
        return { content: [{ type: "text", text: message }], isError: true };
      }
    }
    default:
      throw new RpcError(-32601, `Method not found: ${msg.method}`);
  }
}

/** Returns the response for a request, or null for a notification or a client response. */
async function handleMessage(req: IncomingMessage, msg: JsonRpcMessage) {
  if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0") {
    return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid JSON-RPC message" } };
  }
  if (msg.method === undefined || msg.id === undefined) return null;
  try {
    return { jsonrpc: "2.0", id: msg.id, result: await dispatch(req, msg) };
  } catch (err) {
    const code = err instanceof RpcError ? err.code : -32603;
    if (!(err instanceof RpcError)) console.error("[api/mcp]", err);
    return { jsonrpc: "2.0", id: msg.id, error: { code, message: err instanceof RpcError ? err.message : "Internal error" } };
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, {
      error: "This MCP server speaks Streamable HTTP: POST JSON-RPC messages to https://openeye.sh/mcp. It has no SSE stream.",
    });
  }
  let body: unknown;
  try {
    body = JSON.parse((await readRawBody(req, MAX_BODY_BYTES)).toString("utf8"));
  } catch (err) {
    if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
    return sendJson(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  }

  const batch = Array.isArray(body);
  const messages = (batch ? body : [body]) as JsonRpcMessage[];
  const replies = (await Promise.all(messages.map((m) => handleMessage(req, m)))).filter((r) => r !== null);
  if (replies.length === 0) {
    res.statusCode = 202;
    return res.end();
  }
  sendJson(res, 200, batch ? replies : replies[0]);
}
