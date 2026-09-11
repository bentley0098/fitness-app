// RFC 9728 — tells the MCP client which authorization server protects
// /api/mcp. Public, unauthenticated, per spec.
export default defineEventHandler((event) => {
  const origin = getRequestURL(event).origin;

  return {
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
  };
});
