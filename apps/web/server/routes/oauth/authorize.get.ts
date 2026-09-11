import { getClient } from "../../utils/oauth";
import { renderLoginPage } from "../../utils/oauthLoginPage";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const clientId = String(query.client_id ?? "");
  const redirectUri = String(query.redirect_uri ?? "");
  const responseType = String(query.response_type ?? "");
  const codeChallenge = String(query.code_challenge ?? "");
  const codeChallengeMethod = String(query.code_challenge_method ?? "");
  const state = String(query.state ?? "");
  const resource = String(query.resource ?? "");

  const client = await getClient(clientId);
  if (!client || !client.redirectUris.includes(redirectUri)) {
    // Can't safely redirect — the redirect_uri itself is what's unverified.
    throw createError({ statusCode: 400, statusMessage: "Unknown client_id or unregistered redirect_uri" });
  }

  if (responseType !== "code" || !codeChallenge || codeChallengeMethod !== "S256") {
    const url = new URL(redirectUri);
    url.searchParams.set("error", "invalid_request");
    if (state) url.searchParams.set("state", state);
    return sendRedirect(event, url.toString());
  }

  setResponseHeader(event, "Content-Type", "text/html; charset=utf-8");
  return renderLoginPage({ clientId, redirectUri, codeChallenge, codeChallengeMethod, state, resource });
});
