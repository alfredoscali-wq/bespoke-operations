import { recordAuditEventClient } from "@/lib/audit/record-audit-event.client"
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, AUDIT_MODULES } from "@/lib/audit/types"

export function buildPlanningConfirmAuditDescription(input: {
  date: string
  taskCount: number
  crewName?: string
  scope?: "crew" | "journey"
}): string {
  const otLabel =
    input.taskCount === 1
      ? "1 orden de trabajo"
      : `${input.taskCount} órdenes de trabajo`

  if (input.scope === "crew" && input.crewName?.trim()) {
    return `Planificación confirmada para ${input.crewName.trim()}. Fecha ${input.date}. ${otLabel} asignadas.`
  }

  return `Jornada confirmada. Fecha ${input.date}. ${otLabel} asignadas.`
}

/** Best-effort audit write. Never throws; failures are logged as warnings only. */
export function recordPlanningConfirmAudit(input: {
  date: string
  taskCount: number
  crewName?: string
  scope?: "crew" | "journey"
}): void {
  void recordAuditEventClient({
    module: AUDIT_MODULES.TAREAS,
    action: AUDIT_ACTIONS.PLANNING_CONFIRMED,
    entityType: AUDIT_ENTITY_TYPES.TASK,
    entityId: null,
    entityLabel: input.date,
    description: buildPlanningConfirmAuditDescription(input),
    metadata: {
      planningDate: input.date,
      taskCount: input.taskCount,
      crewName: input.crewName ?? null,
      scope: input.scope ?? "journey",
    },
  })
}
