import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client.
 *
 * Intentionally untyped: this project queries non-public schemas
 * (core, acct, maint, mkt, prep) via .schema(...), which the Supabase
 * generated types don't cover. Row shapes are defined explicitly in
 * src/lib/db and src/lib/audit/types.ts.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

export function createAdminClient(): AnySupabaseClient {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  ) as AnySupabaseClient;
}