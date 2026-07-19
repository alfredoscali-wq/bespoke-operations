/**
 * RC 3.2.0 — optional post-resolution follow-up actions.
 * Separate from consultation lifecycle / next_step. Does not create OTs.
 */

export const CONSULTATION_FOLLOW_UP_ACTION_VALUES = ["generar_ot"] as const

export type ConsultationFollowUpAction =
  (typeof CONSULTATION_FOLLOW_UP_ACTION_VALUES)[number]

export type ConsultationFollowUpActionOption = {
  id: ConsultationFollowUpAction
  label: string
}

/** Catalog of selectable post-resolve actions (extensible). */
export const CONSULTATION_FOLLOW_UP_ACTION_OPTIONS: readonly ConsultationFollowUpActionOption[] =
  [
    {
      id: "generar_ot",
      label: "Generar Orden de Trabajo",
    },
  ]

const FOLLOW_UP_MARKER_RE = /\[\[follow_up:([a-z0-9_]+)\]\]/g

export function isConsultationFollowUpAction(
  value: string
): value is ConsultationFollowUpAction {
  return (CONSULTATION_FOLLOW_UP_ACTION_VALUES as readonly string[]).includes(
    value
  )
}

export function normalizeConsultationFollowUpActions(
  values: readonly string[] | null | undefined
): ConsultationFollowUpAction[] {
  if (!values?.length) {
    return []
  }

  const unique = new Set<ConsultationFollowUpAction>()
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed && isConsultationFollowUpAction(trimmed)) {
      unique.add(trimmed)
    }
  }

  return CONSULTATION_FOLLOW_UP_ACTION_VALUES.filter((id) => unique.has(id))
}

export function validateConsultationFollowUpActions(
  values: unknown
): ConsultationFollowUpAction[] | { error: string } {
  if (values == null) {
    return []
  }

  if (!Array.isArray(values)) {
    return { error: "Las acciones posteriores no son válidas." }
  }

  const normalized: string[] = []
  for (const value of values) {
    if (typeof value !== "string") {
      return { error: "Las acciones posteriores no son válidas." }
    }
    const trimmed = value.trim()
    if (!trimmed) {
      continue
    }
    if (!isConsultationFollowUpAction(trimmed)) {
      return { error: "Acción posterior no válida." }
    }
    normalized.push(trimmed)
  }

  return normalizeConsultationFollowUpActions(normalized)
}

export function consultationNeedsOtFollowUp(
  followUpActions: readonly string[] | null | undefined
): boolean {
  return normalizeConsultationFollowUpActions(followUpActions).includes(
    "generar_ot"
  )
}

/** Bake follow-up markers into resolve event detail (same management event). */
export function formatResolveEventDetail(
  resolution: string,
  followUpActions: readonly ConsultationFollowUpAction[]
): string {
  const base = resolution.trim()
  const actions = normalizeConsultationFollowUpActions(followUpActions)
  if (actions.length === 0) {
    return base
  }

  const markers = actions.map((action) => `[[follow_up:${action}]]`).join("\n")
  return `${base}\n\n${markers}`
}

export function parseResolveEventDetail(detail: string | null | undefined): {
  resolution: string
  followUpActions: ConsultationFollowUpAction[]
} {
  const raw = detail?.trim() ?? ""
  if (!raw) {
    return { resolution: "", followUpActions: [] }
  }

  const found: string[] = []
  const withoutMarkers = raw
    .replace(FOLLOW_UP_MARKER_RE, (_match, action: string) => {
      found.push(action)
      return ""
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  return {
    resolution: withoutMarkers,
    followUpActions: normalizeConsultationFollowUpActions(found),
  }
}

export function formatResolveFollowUpClosingNote(
  followUpActions: readonly ConsultationFollowUpAction[]
): string | null {
  const actions = normalizeConsultationFollowUpActions(followUpActions)
  if (actions.includes("generar_ot")) {
    return "La consulta fue resuelta por Atención al Cliente. Se solicitó la generación de una Orden de Trabajo."
  }

  return null
}
