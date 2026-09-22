import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only client. Uses Supabase's "Secret" key (formerly service_role),
// which bypasses row-level security entirely — fine here because this is a
// single-user app with no RLS policies (auth is the app-level bearer token,
// not Supabase auth). Never expose this key to the browser bundle.
//
// Constructed lazily, on first query rather than at import time. createClient
// throws synchronously when SUPABASE_URL is unset, and in dev Nitro evaluates
// every server module in a single bundle — so calling it at module level took
// down the entire server, renderer included ("Cannot access 'renderer' before
// initialization"), and even static pages 500'd. Deferring it means a missing
// env var surfaces only on the routes that actually need the database.
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    // A plain Error, not createError: this module is also imported by the
    // standalone scripts under tsx, where Nitro's auto-imports don't exist.
    // Nitro turns an uncaught throw into a 500 either way.
    throw new Error("Supabase is not configured — set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

// A Proxy rather than a getDb() function, so every existing `db.from(...)`
// call site — API routes, server utils and the standalone scripts — keeps
// working unchanged.
export const db = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const real = getClient();
    const value = Reflect.get(real, prop);
    // Bind methods to the real client: called through the proxy they would
    // otherwise receive the proxy as `this`, which breaks supabase-js
    // internals that read private state.
    return typeof value === "function" ? value.bind(real) : value;
  },
});
