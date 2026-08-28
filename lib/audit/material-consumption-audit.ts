import { recordAuditEventClient } from "@/lib/audit/record-audit-event.client"
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, AUDIT_MODULES } from "@/lib/audit/types"
import { formatUnitLabel } from "@/lib/materials/units"
import type { TaskMaterialLineView } from "@/lib/types/materials"

type ConsumptionAuditLine = Pick<
  TaskMaterialLineView,
  | "id"
  | "materialId"
  | "materialCode"
  | "materialName"
  | "warehouseId"
  | "warehouseName"
  | "unit"
>

function buildAuditMetadata(input: {
  taskId: string
  taskCode?: string | null
  line: ConsumptionAuditLine
  quantity: number
}) {
  return {
    taskId: input.taskId,
    taskCode: input.taskCode ?? null,
    lineId: input.line.id,
    materialId: input.line.materialId,
    materialCode: input.line.materialCode,
    materialName: input.line.materialName,
    warehouseId: input.line.warehouseId,
    warehouseName: input.line.warehouseName,
    quantity: input.quantity,
    unit: input.line.unit,
  }
}

export function recordMaterialConsumptionCreatedAudit(input: {
  taskId: string
  taskCode?: string | null
  line: ConsumptionAuditLine
  quantity: number
}) {
  void recordAuditEventClient({
    module: AUDIT_MODULES.TAREAS,
    action: AUDIT_ACTIONS.MATERIAL_CONSUMPTION_CREATED,
    entityType: AUDIT_ENTITY_TYPES.TASK,
    entityId: input.taskId,
    entityLabel: input.taskCode ?? input.taskId,
    description: `Consumo registrado: ${input.line.materialCode} · ${input.quantity.toLocaleString("es-AR")} ${formatUnitLabel(input.line.unit)} · ${input.line.warehouseName}`,
    metadata: buildAuditMetadata(input),
  })
}

export function recordMaterialReturnCreatedAudit(input: {
  taskId: string
  taskCode?: string | null
  line: ConsumptionAuditLine
  quantity: number
}) {
  void recordAuditEventClient({
    module: AUDIT_MODULES.TAREAS,
    action: AUDIT_ACTIONS.MATERIAL_RETURN_CREATED,
    entityType: AUDIT_ENTITY_TYPES.TASK,
    entityId: input.taskId,
    entityLabel: input.taskCode ?? input.taskId,
    description: `Devolución registrada: ${input.line.materialCode} · ${input.quantity.toLocaleString("es-AR")} ${formatUnitLabel(input.line.unit)} · ${input.line.warehouseName}`,
    metadata: buildAuditMetadata(input),
  })
}
