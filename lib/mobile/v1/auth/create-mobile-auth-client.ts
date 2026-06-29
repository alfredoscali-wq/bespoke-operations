import "server-only"

import { createClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import { assertSupabaseEnv } from "@/lib/supabase/env"

/**
 * Stateless Supabase client for mobile password authentication.
 * Does not read or write browser cookies.
 */
export function createMobileAuthClient() {
  const { url, anonKey } = assertSupabaseEnv()

  return createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
