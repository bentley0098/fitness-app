import { generateToken, getClient } from "../../utils/oauth";
import { renderLoginPage } from "../../utils/oauthLoginPage";

const CODE_TTL_MS = 10 * 60 * 1000;

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    password?: string;
    client_id?: string;
    redirect_uri?: string;
    code_challenge?: string;
    code_challenge_method?: string;
    state?: string;
    resource?: string;
  }>(event);

  const params = {
    clientId: body.client_id ?? "",
    redirectUri: body.redirect_uri ?? "",
    codeChallenge: body.code_challenge ?? "",
    codeChallengeMethod: body.code_challenge_method ?? "",
    state: body.state ?? "",
    resource: body.resource ?? "",
  };

  // Re-validate — don't trust hidden fields alone, they're just carried
  // state, not a security boundary.
  const client = await getClient(params.clientId);
  if (!client || !client.redirectUris.includes(params.redirectUri)) {
    throw createError({ statusCode: 400, statusMessage: "Unknown client_id or unregistered redirect_uri" });
  }

  if (body.password !== process.env.MCP_OAUTH_PASSWORD) {
    setResponseHeader(event, "Content-Type", "text/html; charset=utf-8");
    setResponseStatus(event, 401);
    return renderLoginPage(params, "Incorrect password");
  }

  const code = generateToken(32);
  const { error } = await db.from("oauth_codes").insert({
    code,
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    code_challenge: params.codeChallenge,
    code_challenge_method: params.codeChallengeMethod,
    resource: params.resource || null,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  const url = new URL(params.redirectUri);
  url.searchParams.set("code", code);
  if (params.state) url.searchParams.set("state", params.state);
  return sendRedirect(event, url.toString());
});
