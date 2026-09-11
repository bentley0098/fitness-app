import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "../mcp/createServer";
import { validateAccessToken } from "../utils/oauth";

function jsonRpcError(res: import("node:http").ServerResponse, status: number, message: string, wwwAuthenticate?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (wwwAuthenticate) headers["WWW-Authenticate"] = wwwAuthenticate;
  res.writeHead(status, headers).end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }));
}

// Remote HTTP MCP server (spec Section 6) — stateless transport (each
// request gets a fresh server+transport pair; nothing here needs
// cross-request session state, and Vercel functions don't reliably keep
// in-memory state between invocations anyway).
//
// Two valid auth paths, deliberately: the static MCP_BEARER_TOKEN (manual
// use — curl, Claude Code's MCP config) and OAuth access tokens issued by
// server/routes/oauth/* (claude.ai's custom-connector UI, which requires
// OAuth and has no plain-header option).
export default defineEventHandler(async (event) => {
  const req = event.node.req;
  const res = event.node.res;

  const authHeader = getHeader(event, "authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const wwwAuthenticate = `Bearer resource_metadata="${getRequestURL(event).origin}/.well-known/oauth-protected-resource"`;

  if (!bearer) {
    return jsonRpcError(res, 401, "Unauthorized", wwwAuthenticate);
  }
  const isStaticToken = bearer === process.env.MCP_BEARER_TOKEN;
  const isValidOAuthToken = !isStaticToken && (await validateAccessToken(bearer));
  if (!isStaticToken && !isValidOAuthToken) {
    return jsonRpcError(res, 401, "Unauthorized", wwwAuthenticate);
  }

  if (req.method !== "POST") {
    return jsonRpcError(res, 405, "Method not allowed — this endpoint is stateless, POST only.");
  }

  const body = await readBody(event);
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } finally {
    res.on("close", () => {
      transport.close();
      server.close();
    });
  }
});
