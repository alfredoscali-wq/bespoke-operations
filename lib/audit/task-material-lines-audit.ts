import { recordAuditEventClient } from "@/lib/audit/record-audit-event.client"
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, AUDIT_MODULES } from "@/lib/audit/types"
import { formatUnitLabel } from "@/lib/materials/units"
import type { TaskMaterialLineView } from "@/lib/types/materials"

function formatLineLabel(line: Pick<
  TaskMaterialLineView,
  "materialCode" | "materialName" | "quantityPlanned" | "unit" | "warehouseName"
>): string {
  return `${line.materialCode} — ${line.materialName} · ${line.quantityPlanned.toLocaleString("es-AR")} ${formatUnitLabel(line.unit)} · ${line.warehouseName}`
}

export function recordTaskMaterialLineAddedAudit(input: {
  taskId: string
  taskCode?: string | null
  line: TaskMaterialLineView
}): void {
  void recordAuditEventClient({
    module: AUDIT_MODULES.TAREAS,
    action: AUDIT_ACTIONS.TASK_MATERIAL_LINE_ADD,
    entityType: AUDIT_ENTITY_TYPES.TASK,
    entityId: input.taskId,
    entityLabel: input.taskCode?.trim() || input.taskId,
    description: `Material agregado a la OT: ${formatLineLabel(input.line)}.`,
    metadata: {
      lineId: input.line.id,
      materialId: input.line.materialId,
      warehouseId: input.line.warehouseId,
      quantityPlanned: input.line.quantityPlanned,
      unit: input.line.unit,
    },
  })
}

export function recordTaskMaterialLineUpdatedAudit(input: {
  taskId: string
  taskCode?: string | null
  before: TaskMaterialLineView
  after: TaskMaterialLineView
}): void {
  void recordAuditEventClient({
    module: AUDIT_MODULES.TAREAS,
    action: AUDIT_ACTIONS.TASK_MATERIAL_LINE_UPDATE,
    entityType: AUDIT_ENTITY_TYPES.TASK,
    entityId: input.taskId,
    entityLabel: input.taskCode?.trim() || input.taskId,
    description: `Material modificado en la OT: ${formatLineLabel(input.after)}.`,
    metadata: {
      lineId: input.after.id,
      before: {
        quantityPlanned: input.before.quantityPlanned,
        warehouseId: input.before.warehouseId,
        notes: input.before.notes,
      },
      after: {
        quantityPlanned: input.after.quantityPlanned,
        warehouseId: input.after.warehouseId,
        notes: input.after.notes,
      },
    },
  })
}

export function recordTaskMaterialLineDeletedAudit(input: {
  taskId: string
  taskCode?: string | null
  line: TaskMaterialLineView
}): void {
  void recordAuditEventClient({
    module: AUDIT_MODULES.TAREAS,
    action: AUDIT_ACTIONS.TASK_MATERIAL_LINE_DELETE,
    entityType: AUDIT_ENTITY_TYPES.TASK,
    entityId: input.taskId,
    entityLabel: input.taskCode?.trim() || input.taskId,
    description: `Material eliminado de la OT: ${formatLineLabel(input.line)}.`,
    metadata: {
      lineId: input.line.id,
      materialId: input.line.materialId,
      warehouseId: input.line.warehouseId,
      quantityPlanned: input.line.quantityPlanned,
      unit: input.line.unit,
    },
  })
}
