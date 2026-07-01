import { recordAuditEventClient } from "@/lib/audit/record-audit-event.client"
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, AUDIT_MODULES } from "@/lib/audit/types"

export function buildPlanningConfirmAuditDescription(input: {
  date: string
  taskCount: number
}): string {
  const otLabel =
    input.taskCount === 1
      ? "1 orden de trabajo"
      : `${input.taskCount} órdenes de trabajo`

  return `Planificación confirmada. Fecha ${input.date}. ${otLabel} asignadas.`
}

/** Best-effort audit write. Never throws; failures are logged as warnings only. */
export function recordPlanningConfirmAudit(input: {
  date: string
  taskCount: number
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
    },
  })
}
