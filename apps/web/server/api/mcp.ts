import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "../mcp/createServer";

function jsonRpcError(res: import("node:http").ServerResponse, status: number, message: string) {
  res.writeHead(status, { "Content-Type": "application/json" }).end(
    JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }),
  );
}

// Remote HTTP MCP server (spec Section 6) — bearer-token auth, stateless
// transport (each request gets a fresh server+transport pair; nothing here
// needs cross-request session state, and Vercel functions don't reliably
// keep in-memory state between invocations anyway).
export default defineEventHandler(async (event) => {
  const req = event.node.req;
  const res = event.node.res;

  const authHeader = getHeader(event, "authorization");
  if (authHeader !== `Bearer ${process.env.MCP_BEARER_TOKEN}`) {
    return jsonRpcError(res, 401, "Unauthorized");
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
