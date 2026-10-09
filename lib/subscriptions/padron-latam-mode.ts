import type { LatamBatchClient } from "@/lib/integrations/latam-tv/lookup-state"
import { abnetPadronCustomerNumber } from "@/lib/subscriptions/abnet-tv-padron"

export const LATAM_LINKED_MISSING_FICHA = "Cliente LATAM vinculado · Falta ficha Bespoke"
export const LATAM_LINKED_MANY_FICHAS = "Cliente LATAM vinculado · Hay múltiples fichas Bespoke"
export const LATAM_NOT_LINKED = "Cliente no vinculado con LATAM"
export const LATAM_UNAVAILABLE = "LATAM no disponible"
export const LATAM_IDENTITY_CONFLICT = "No se puede operar por conflicto de identidad"

type PadronLatamRow = {
  abnetCustomerNumber: string
  bespokeCustomerId: string | null
  bespokeLink?: "none" | "one" | "many"
}

export type PadronLatamMode =
  | { kind: "pending"; reason: string }
  | { kind: "active" }
  | { kind: "suspended" }
  | { kind: "signup" }
  | { kind: "blocked"; reason: string }

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
  const number = abnetPadronCustomerNumber(row.abnetCustomerNumber)
  if (!number) return { kind: "blocked", reason: LATAM_NOT_LINKED }
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
  if (client.phase === "unregistered") return { kind: "signup" }
  return { kind: "blocked", reason: LATAM_UNAVAILABLE }
}
