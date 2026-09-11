import { randomBytes, createHash } from "node:crypto";
import { db } from "./db";

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function pkceMatches(codeVerifier: string, codeChallenge: string, method: string): boolean {
  if (method !== "S256") return false; // plain method deliberately unsupported — S256 only
  const computed = createHash("sha256").update(codeVerifier).digest("base64url");
  return computed === codeChallenge;
}

export interface OAuthClient {
  clientId: string;
  redirectUris: string[];
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  const { data, error } = await db.from("oauth_clients").select("*").eq("client_id", clientId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { clientId: data.client_id, redirectUris: data.redirect_uris as string[] };
}

// Access tokens are validated here; MCP_BEARER_TOKEN (checked separately in
// server/api/mcp.ts) remains valid too — this adds a path, doesn't replace one.
export async function validateAccessToken(token: string): Promise<boolean> {
  const { data, error } = await db.from("oauth_tokens").select("access_token_expires_at").eq("access_token", token).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return false;
  return new Date(data.access_token_expires_at) > new Date();
}
