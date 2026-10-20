import type { LatamBatchClient } from "@/lib/integrations/latam-tv/lookup-state"
import {
  latamSignupPersistedView,
  type LatamSignupAttemptState,
} from "@/lib/integrations/latam-tv/signup-attempt"
import {
  latamSignupCredentialMessage,
  type LatamSignupCredentialGap,
} from "@/lib/integrations/latam-tv/signup"
import { abnetPadronCustomerNumber } from "@/lib/subscriptions/abnet-tv-padron"
import { bespokeCliCustomerNumber } from "@/lib/subscriptions/tv-ot-signups"

export const LATAM_LINKED_MISSING_FICHA = "Cliente LATAM vinculado · Falta ficha Bespoke"
export const LATAM_LINKED_MANY_FICHAS = "Cliente LATAM vinculado · Hay múltiples fichas Bespoke"
export const LATAM_NOT_LINKED = "Cliente no vinculado con LATAM"
export const LATAM_UNAVAILABLE = "LATAM no disponible"
export const LATAM_IDENTITY_CONFLICT = "No se puede operar por conflicto de identidad"
export const LATAM_SIGNUP_MISSING_FICHA =
  "No se puede dar de alta al cliente en Latam porque no hay una ficha vinculada en Clientes 360."
export const LATAM_SIGNUP_AMBIGUOUS_FICHA =
  "No se puede dar de alta al cliente en Latam porque hay más de una ficha en Clientes 360."
export const LATAM_LINK_REVIEW =
  "No se puede vincular con LATAM. La coincidencia no es inequívoca y no se modificó nada."

type PadronLatamRow = {
  abnetCustomerNumber: string
  bespokeCustomerId: string | null
  bespokeLink?: "none" | "one" | "many"
  latamCredentialGap?: LatamSignupCredentialGap | null
  latamSignupAttempt?: {
    state: LatamSignupAttemptState
    latamCode?: number | null
    iptvId?: string | null
  } | null
}

export type PadronLatamMode =
  | { kind: "pending"; reason: string }
  | { kind: "active" }
  | { kind: "suspended" }
  | { kind: "signup" }
  | { kind: "link" }
  | { kind: "review"; reason: string }
  | { kind: "pending_sync" }
  | { kind: "confirmed" }
  | { kind: "blocked"; reason: string }

function openSignup(row: PadronLatamRow): PadronLatamMode {
  const view = latamSignupPersistedView(row.latamSignupAttempt)
  if (view === "confirmed") return { kind: "confirmed" }
  if (view === "pending_sync") return { kind: "pending_sync" }
  return { kind: "signup" }
}

function credentialBlock(row: PadronLatamRow): PadronLatamMode | null {
  if (!row.latamCredentialGap) return null
  return { kind: "blocked", reason: latamSignupCredentialMessage(row.latamCredentialGap) }
}

function latamLinked(presence: LatamBatchClient, number: string): boolean {
  return (
    presence.identifier === number &&
    (presence.phase === "active" || presence.phase === "suspended")
  )
}

/**
 * El vínculo LATAM se lee del identificador. La ficha Bespoke solo decide si se puede escribir.
 */
export function padronLatamMode(
  row: PadronLatamRow,
  latamByNumber: Record<string, LatamBatchClient>
): PadronLatamMode {
  const numeric = abnetPadronCustomerNumber(row.abnetCustomerNumber)
  const cli = bespokeCliCustomerNumber(row.abnetCustomerNumber)
  const number = numeric ?? cli
  if (!number) return { kind: "blocked", reason: LATAM_NOT_LINKED }
  if (cli && !numeric) {
    const link = row.bespokeLink ?? (row.bespokeCustomerId ? "one" : "none")
    if (link === "many") return { kind: "blocked", reason: LATAM_SIGNUP_AMBIGUOUS_FICHA }
    if (link !== "one" || !row.bespokeCustomerId) {
      return { kind: "blocked", reason: LATAM_SIGNUP_MISSING_FICHA }
    }
    const blocked = credentialBlock(row)
    if (blocked) return blocked
    if (row.latamCredentialGap !== null) {
      return { kind: "blocked", reason: latamSignupCredentialMessage("both") }
    }
    return openSignup(row)
  }
  const client = latamByNumber[number]
  if (!client) return { kind: "pending", reason: "Consultando LATAM" }
  if (client.identifier != null && client.identifier !== number) {
    return { kind: "blocked", reason: LATAM_IDENTITY_CONFLICT }
  }
  if (client.phase === "unavailable") return { kind: "blocked", reason: LATAM_UNAVAILABLE }
  if (latamLinked(client, number)) {
    const link = row.bespokeLink ?? (row.bespokeCustomerId ? "one" : "none")
    if (link === "many") return { kind: "blocked", reason: LATAM_LINKED_MANY_FICHAS }
    if (link !== "one" || !row.bespokeCustomerId) {
      return { kind: "blocked", reason: LATAM_LINKED_MISSING_FICHA }
    }
    return client.phase === "suspended" ? { kind: "suspended" } : { kind: "active" }
  }
  if (client.phase === "unregistered") {
    const blocked = credentialBlock(row)
    if (blocked) return blocked
    if (client.link === "ready") return { kind: "link" }
    if (client.link === "review") return { kind: "review", reason: LATAM_LINK_REVIEW }
    return openSignup(row)
  }
  return { kind: "blocked", reason: LATAM_UNAVAILABLE }
}
