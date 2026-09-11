import type { GarminTokens, TokenStorage } from "garmin-connect-sdk";
import { db } from "./db";

const ROW_ID = "default";

// Explicit import (rather than relying on Nitro's auto-import) because this
// class is also loaded by scripts/garmin-login.ts via plain tsx, outside the
// Nuxt/Nitro runtime where auto-imports don't exist.

// Backs the SDK's TokenStorage interface with the garmin_tokens table instead
// of a local file — a Vercel serverless function has no persistent disk
// between invocations, so FileTokenStorage doesn't survive across cron runs.
export class SupabaseTokenStorage implements TokenStorage {
  async load(): Promise<GarminTokens | null> {
    const { data, error } = await db.from("garmin_tokens").select("*").eq("id", ROW_ID).maybeSingle();
    if (error) throw new Error(`garmin_tokens load failed: ${error.message}`);
    if (!data) return null;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      accessTokenExpiresAt: data.access_token_expires_at,
      refreshTokenExpiresAt: data.refresh_token_expires_at ?? undefined,
      tokenType: data.token_type ?? undefined,
      scope: data.scope ?? undefined,
      displayName: data.display_name ?? undefined,
      clientId: data.client_id ?? undefined,
    };
  }

  async save(tokens: GarminTokens): Promise<void> {
    const { error } = await db.from("garmin_tokens").upsert({
      id: ROW_ID,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      access_token_expires_at: tokens.accessTokenExpiresAt,
      refresh_token_expires_at: tokens.refreshTokenExpiresAt ?? null,
      token_type: tokens.tokenType ?? null,
      scope: tokens.scope ?? null,
      display_name: tokens.displayName ?? null,
      client_id: tokens.clientId ?? null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(`garmin_tokens save failed: ${error.message}`);
  }

  async clear(): Promise<void> {
    const { error } = await db.from("garmin_tokens").delete().eq("id", ROW_ID);
    if (error) throw new Error(`garmin_tokens clear failed: ${error.message}`);
  }
}
