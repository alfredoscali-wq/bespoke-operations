import { createClient as createServerClient } from "@/lib/supabase/server"

export type SupabaseHealthResult = {
  ok: boolean
  configured: boolean
  reachable: boolean
  message: string
  checkedAt: string
  details?: {
    hasSession: boolean
  }
  error?: string
}

export async function checkSupabaseConnection(): Promise<SupabaseHealthResult> {
  const checkedAt = new Date().toISOString()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return {
      ok: false,
      configured: false,
      reachable: false,
      message: "Supabase environment variables are not configured.",
      checkedAt,
      error: "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
    }
  }

  try {
    const supabase = await createServerClient()
    const { data, error } = await supabase.auth.getSession()

    if (error) {
      return {
        ok: false,
        configured: true,
        reachable: false,
        message: "Supabase credentials are set but the API returned an error.",
        checkedAt,
        error: error.message,
      }
    }

    return {
      ok: true,
      configured: true,
      reachable: true,
      message: "Supabase connection successful.",
      checkedAt,
      details: {
        hasSession: Boolean(data.session),
      },
    }
  } catch (error) {
    return {
      ok: false,
      configured: Boolean(url && anonKey),
      reachable: false,
      message: "Failed to initialize Supabase client.",
      checkedAt,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
