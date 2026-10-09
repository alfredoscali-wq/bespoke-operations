export const LATAM_LOOKUP_LABEL = {
  active: "LATAM: Activo",
  suspended: "LATAM: Suspendido",
  unregistered: "LATAM: No registrado",
  unavailable: "LATAM: No disponible",
  partial: "LATAM: Requiere revisión",
  ambiguous: "LATAM: Coincidencia ambigua",
} as const

export type LatamLookupUiPhase = keyof typeof LATAM_LOOKUP_LABEL

export type LatamBatchClient = {
  phase: "active" | "suspended" | "unregistered" | "unavailable"
  identifier: string | null
  iptvId: string | null
  username: string | null
  planName: string | null
}

type LookupBody = {
  success?: unknown
  found?: unknown
  outcome?: unknown
  identifier?: unknown
  status?: unknown
  planName?: unknown
  matchedOn?: unknown
  reason?: unknown
  client?: {
    status?: unknown
    username?: unknown
    plan?: { name?: unknown } | null
  } | null
}

function asBody(value: unknown): LookupBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as LookupBody
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed || null
}

function view(
  phase: LatamLookupUiPhase,
  extra?: { username?: string | null; planName?: string | null; identifier?: string | null; detail?: string | null }
) {
  return {
    phase,
    label: LATAM_LOOKUP_LABEL[phase],
    username: extra?.username ?? null,
    planName: extra?.planName ?? null,
    identifier: extra?.identifier ?? null,
    detail: extra?.detail ?? null,
  }
}

/**
 * Maps the internal identity JSON to the TV dialog.
 * A successful `not_found` is not registered.
 * `partial_match` and `ambiguous` are not availability errors.
 */
export function latamLookupUiState(httpOk: boolean, body: unknown) {
  const payload = asBody(body)
  if (!httpOk || payload?.success !== true) return view("unavailable")

  const identifier = text(payload.identifier)
  const planName = text(payload.planName) ?? text(payload.client?.plan?.name)
  const username = text(payload.client?.username)
  const status = payload.status ?? payload.client?.status

  if (payload.outcome === "not_found" || (payload.outcome == null && payload.found === false)) {
    return view("unregistered")
  }
  if (payload.outcome === "partial_match") {
    const detail =
      payload.matchedOn === "email"
        ? "Coincide el email, pero no el DNI. No se vinculó automáticamente."
        : "Coincide el DNI, pero no el email. No se vinculó automáticamente."
    return view("partial", { detail, planName, identifier })
  }
  if (payload.outcome === "ambiguous") {
    return view("ambiguous", {
      detail: "Hay más de un cliente posible en LATAM TV. No se puede vincular automáticamente.",
    })
  }
  if (payload.outcome === "unavailable") return view("unavailable")

  const matched = payload.outcome === "matched" || payload.found === true
  if (!matched) return view("unavailable")
  if (status === "disabled") {
    return view("suspended", { username, planName, identifier })
  }
  if (status === "enabled") {
    return view("active", {
      username,
      planName,
      identifier,
      detail: identifier ? null : "LATAM no informó un identificador utilizable.",
    })
  }
  return view("unavailable")
}
