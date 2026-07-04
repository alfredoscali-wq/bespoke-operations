import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import { assertSupabaseEnv } from "@/lib/supabase/env"

export async function createClient() {
  const { url, anonKey } = assertSupabaseEnv()
  const cookieStore = await cookies()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // setAll can fail in Server Components that cannot mutate cookies.
          // Middleware will handle session refresh in a later auth phase.
        }
      },
    },
  })
}
