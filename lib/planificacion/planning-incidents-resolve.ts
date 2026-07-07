const TASK_INCIDENT_COMMENT_MAX_LENGTH = 2000

export const PLANNING_INCIDENT_RESOLVE_PRIMARY_ACTION_LABEL =
  "Resolver incidencia"

export const PLANNING_INCIDENT_RESOLVE_DECISIONS = [
  { id: "continue", label: "Continuar OT" },
  { id: "reprogram", label: "Reprogramar OT" },
  { id: "cancel", label: "Cancelar OT" },
] as const

export type PlanningIncidentResolveDecision =
  (typeof PLANNING_INCIDENT_RESOLVE_DECISIONS)[number]["id"]

export const LEGACY_PLANNING_INCIDENT_PRIMARY_ACTIONS = [
  "Solicitar información",
  "Replanificar",
  "Cancelar OT",
  "Cerrar incidencia",
  "Continuar",
] as const

export const PLANNING_INCIDENT_TASK_CONTEXT_FIELDS = [
  "taskCode",
  "workTitle",
  "customer",
  "status",
  "crew",
  "operator",
] as const

export type PlanningIncidentResolvePayload =
  | { action: "continue"; message: string }
  | { action: "reprogram"; reason: string }
  | { action: "cancel"; reason: string }

export type PlanningIncidentResolveValidationResult =
  | { ok: true; payload: PlanningIncidentResolvePayload }
  | { ok: false; message: string }

function validateRequiredText(
  value: string,
  fieldLabel: string
): { ok: true; value: string } | { ok: false; message: string } {
  const trimmed = value.trim()

  if (!trimmed) {
    return {
      ok: false,
      message: `${fieldLabel} es obligatorio.`,
    }
  }

  if (trimmed.length > TASK_INCIDENT_COMMENT_MAX_LENGTH) {
    return {
      ok: false,
      message: `${fieldLabel} supera el límite de ${TASK_INCIDENT_COMMENT_MAX_LENGTH} caracteres.`,
    }
  }

  return { ok: true, value: trimmed }
}

export function buildPlanningIncidentResolvePayload(input: {
  decision: PlanningIncidentResolveDecision
  message?: string
  reason?: string
}): PlanningIncidentResolveValidationResult {
  if (input.decision === "continue") {
    const message = validateRequiredText(
      input.message ?? "",
      "El mensaje al operario"
    )

    if (!message.ok) {
      return message
    }

    return {
      ok: true,
      payload: {
        action: "continue",
        message: message.value,
      },
    }
  }

  const reason = validateRequiredText(input.reason ?? "", "El motivo")

  if (!reason.ok) {
    return reason
  }

  return {
    ok: true,
    payload: {
      action: input.decision,
      reason: reason.value,
    },
  }
}

export function buildPlanningIncidentResolveSuccessMessage(
  decision: PlanningIncidentResolveDecision
): string {
  switch (decision) {
    case "continue":
      return "Incidencia resuelta. La OT continúa en ejecución."
    case "reprogram":
      return "Incidencia resuelta. La OT volverá a Administración para replanificarse."
    case "cancel":
      return "Incidencia resuelta. La OT fue cancelada."
    default:
      return "Incidencia resuelta correctamente."
  }
}

export function usesLegacyPlanningIncidentPrimaryActions(
  actionLabels: readonly string[]
): boolean {
  return LEGACY_PLANNING_INCIDENT_PRIMARY_ACTIONS.some((legacyAction) =>
    actionLabels.includes(legacyAction)
  )
}
