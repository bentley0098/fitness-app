import { generateToken } from "../../utils/oauth";

// RFC 7591 Dynamic Client Registration. Public, unauthenticated by design —
// that's the point of DCR (any MCP client can register itself without a
// human pre-provisioning it). The actual gate is the password prompt at
// /oauth/authorize; registering a client_id alone grants nothing.
export default defineEventHandler(async (event) => {
  const body = await readBody<{ redirect_uris?: string[]; client_name?: string }>(event);

  if (!body.redirect_uris?.length) {
    throw createError({ statusCode: 400, statusMessage: "redirect_uris is required" });
  }
  for (const uri of body.redirect_uris) {
    const isLocalhost = uri.startsWith("http://localhost") || uri.startsWith("http://127.0.0.1");
    if (!uri.startsWith("https://") && !isLocalhost) {
      throw createError({ statusCode: 400, statusMessage: `redirect_uri must be https or localhost: ${uri}` });
    }
  }

  const clientId = generateToken(16);
  const { error } = await db.from("oauth_clients").insert({
    client_id: clientId,
    client_name: body.client_name ?? null,
    redirect_uris: body.redirect_uris,
  });
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  setResponseStatus(event, 201);
  return {
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: body.redirect_uris,
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  };
});
