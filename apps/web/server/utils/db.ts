import { createClient } from "@supabase/supabase-js";

// Server-only client. Uses Supabase's "Secret" key (formerly service_role),
// which bypasses row-level security entirely — fine here because this is a
// single-user app with no RLS policies (auth is the app-level bearer token,
// not Supabase auth). Never expose this key to the browser bundle.
export const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
