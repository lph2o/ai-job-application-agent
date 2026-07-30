import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Creates a Supabase admin client using the service role key.
 * Use this ONLY in server-side code (Inngest background functions, API routes).
 * ⚠️ Never use this on the client side — it bypasses Row Level Security.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      "[Supabase Admin] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable."
    )
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
