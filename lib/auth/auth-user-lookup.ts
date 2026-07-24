import "server-only"

import type { User } from "@supabase/supabase-js"

import {
  buildAuthEmailCandidatesForDni,
  normalizeDni,
  parseDniFromAuthEmail,
} from "@/lib/auth/auth-identity"
import type { SupabaseAdminClient } from "@/lib/supabase/admin"

const LOOKUP_PAGE_SIZE = 200
const LOOKUP_MAX_PAGES = 25

function metadataNationalId(user: User): string | null {
  const raw = user.user_metadata?.national_id
  if (typeof raw !== "string" || !raw.trim()) return null
  return normalizeDni(raw)
}

/**
 * Locates a single Auth identity for a person by DNI.
 * Matches synthetic emails (any company suffix) and user_metadata.national_id.
 * Does not rely on a single exact email string.
 */
export async function findAuthUserByDni(
  admin: SupabaseAdminClient,
  dni: string
): Promise<User | null> {
  const normalized = normalizeDni(dni)
  if (!normalized) return null

  const emailCandidates = new Set(
    buildAuthEmailCandidatesForDni(normalized).map((email) => email.toLowerCase())
  )

  for (let page = 1; page <= LOOKUP_MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: LOOKUP_PAGE_SIZE,
    })

    if (error) {
      throw new Error(
        `[auth-provisioning] No se pudo listar usuarios Auth: ${error.message}`
      )
    }

    const users = data.users ?? []

    for (const user of users) {
      const email = user.email?.trim().toLowerCase() ?? ""
      if (email && emailCandidates.has(email)) {
        return user
      }

      const dniFromEmail = email ? parseDniFromAuthEmail(email) : null
      if (dniFromEmail === normalized) {
        return user
      }

      if (metadataNationalId(user) === normalized) {
        return user
      }
    }

    if (users.length < LOOKUP_PAGE_SIZE) {
      break
    }
  }

  return null
}

export async function findAuthUserById(
  admin: SupabaseAdminClient,
  authUserId: string
): Promise<User | null> {
  const { data, error } = await admin.auth.admin.getUserById(authUserId)
  if (error || !data.user) {
    return null
  }
  return data.user
}
