import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/lib/supabase/database.types"
import { assertSupabaseEnv } from "@/lib/supabase/env"

export type SupabaseAdminClient = SupabaseClient<Database>

function assertSupabaseServiceRoleKey(): string {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local (server-only — do not use a NEXT_PUBLIC_ prefix)."
    )
  }

  return serviceRoleKey
}

/**
 * Validates admin Supabase env: public project URL + service role secret.
 * @throws if NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing
 */
export function assertSupabaseAdminEnv(): {
  url: string
  serviceRoleKey: string
} {
  const { url } = assertSupabaseEnv()
  const serviceRoleKey = assertSupabaseServiceRoleKey()

  return { url, serviceRoleKey }
}

/**
 * Supabase client with service role privileges. Server-only — never import from Client Components.
 */
export function createAdminClient(): SupabaseAdminClient {
  const { url, serviceRoleKey } = assertSupabaseAdminEnv()

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
