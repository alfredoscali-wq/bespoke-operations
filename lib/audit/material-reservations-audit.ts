import { recordAuditEventClient } from "@/lib/audit/record-audit-event.client"
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, AUDIT_MODULES } from "@/lib/audit/types"
import type { TaskMaterialLineView } from "@/lib/types/materials"

type ReservationAuditLine = Pick<
  TaskMaterialLineView,
  | "id"
  | "materialId"
  | "materialCode"
  | "materialName"
  | "warehouseId"
  | "warehouseName"
  | "quantityPlanned"
  | "unit"
  | "status"
>

function buildReservationMetadata(input: {
  taskId: string
  taskCode?: string | null
  line: ReservationAuditLine
  delta?: number | null
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
    quantity: input.line.quantityPlanned,
    unit: input.line.unit,
    status: input.line.status,
    delta: input.delta ?? null,
  }
}

export function recordMaterialReservationCreatedAudit(input: {
  taskId: string
  taskCode?: string | null
  lines: ReservationAuditLine[]
}) {
  for (const line of input.lines) {
    void recordAuditEventClient({
      module: AUDIT_MODULES.TAREAS,
      action: AUDIT_ACTIONS.MATERIAL_RESERVATION_CREATED,
      entityType: AUDIT_ENTITY_TYPES.TASK,
      entityId: input.taskId,
      entityLabel: input.taskCode ?? input.taskId,
      description: `Reserva creada: ${line.materialCode} · ${line.quantityPlanned} ${line.unit} · ${line.warehouseName}`,
      metadata: buildReservationMetadata({
        taskId: input.taskId,
        taskCode: input.taskCode,
        line,
      }),
    })
  }
}

export function recordMaterialReservationUpdatedAudit(input: {
  taskId: string
  taskCode?: string | null
  line: ReservationAuditLine
  delta?: number | null
}) {
  void recordAuditEventClient({
    module: AUDIT_MODULES.TAREAS,
    action: AUDIT_ACTIONS.MATERIAL_RESERVATION_UPDATED,
    entityType: AUDIT_ENTITY_TYPES.TASK,
    entityId: input.taskId,
    entityLabel: input.taskCode ?? input.taskId,
    description: `Reserva actualizada: ${input.line.materialCode} · ${input.line.quantityPlanned} ${input.line.unit} · ${input.line.warehouseName}`,
    metadata: buildReservationMetadata(input),
  })
}

export function recordMaterialReservationReleasedAudit(input: {
  taskId: string
  taskCode?: string | null
  line: ReservationAuditLine
}) {
  void recordAuditEventClient({
    module: AUDIT_MODULES.TAREAS,
    action: AUDIT_ACTIONS.MATERIAL_RESERVATION_RELEASED,
    entityType: AUDIT_ENTITY_TYPES.TASK,
    entityId: input.taskId,
    entityLabel: input.taskCode ?? input.taskId,
    description: `Reserva liberada: ${input.line.materialCode} · ${input.line.quantityPlanned} ${input.line.unit} · ${input.line.warehouseName}`,
    metadata: buildReservationMetadata({
      taskId: input.taskId,
      taskCode: input.taskCode,
      line: input.line,
    }),
  })
}
