import { generateToken, pkceMatches } from "../../utils/oauth";

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour — short-lived per OAuth 2.1 guidance

async function issueTokenPair(clientId: string, resource: string | null) {
  const accessToken = generateToken(32);
  const refreshToken = generateToken(32);
  const { error } = await db.from("oauth_tokens").insert({
    access_token: accessToken,
    refresh_token: refreshToken,
    client_id: clientId,
    resource,
    access_token_expires_at: new Date(Date.now() + ACCESS_TOKEN_TTL_MS).toISOString(),
  });
  if (error) throw createError({ statusCode: 500, statusMessage: error.message });

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL_MS / 1000,
  };
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, string>>(event);
  const grantType = body.grant_type;

  if (grantType === "authorization_code") {
    const { data: codeRow, error } = await db.from("oauth_codes").select("*").eq("code", body.code ?? "").maybeSingle();
    if (error) throw createError({ statusCode: 500, statusMessage: error.message });
    if (!codeRow || codeRow.used || new Date(codeRow.expires_at) < new Date()) {
      throw createError({ statusCode: 400, statusMessage: "invalid_grant" });
    }
    if (codeRow.client_id !== body.client_id || codeRow.redirect_uri !== body.redirect_uri) {
      throw createError({ statusCode: 400, statusMessage: "invalid_grant" });
    }
    if (!pkceMatches(body.code_verifier ?? "", codeRow.code_challenge, codeRow.code_challenge_method)) {
      throw createError({ statusCode: 400, statusMessage: "invalid_grant: PKCE verification failed" });
    }

    // Single-use — mark it spent before issuing tokens.
    const { error: markUsedError } = await db.from("oauth_codes").update({ used: true }).eq("code", codeRow.code);
    if (markUsedError) throw createError({ statusCode: 500, statusMessage: markUsedError.message });

    return issueTokenPair(codeRow.client_id, codeRow.resource);
  }

  if (grantType === "refresh_token") {
    const { data: tokenRow, error } = await db
      .from("oauth_tokens")
      .select("*")
      .eq("refresh_token", body.refresh_token ?? "")
      .maybeSingle();
    if (error) throw createError({ statusCode: 500, statusMessage: error.message });
    if (!tokenRow) throw createError({ statusCode: 400, statusMessage: "invalid_grant" });

    // Rotate: old refresh token is dead the moment a new pair is issued
    // (OAuth 2.1 requirement for public clients).
    const { error: deleteError } = await db.from("oauth_tokens").delete().eq("refresh_token", tokenRow.refresh_token);
    if (deleteError) throw createError({ statusCode: 500, statusMessage: deleteError.message });

    return issueTokenPair(tokenRow.client_id, tokenRow.resource);
  }

  throw createError({ statusCode: 400, statusMessage: "unsupported_grant_type" });
});
