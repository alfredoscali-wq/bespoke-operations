import { TASK_RESCHEDULE_REASONS } from "@/lib/tasks/reschedule"
import type { OperationalEventActor } from "@/lib/tasks/operational-event-actor"
import { applyOperationalEventActor } from "@/lib/tasks/operational-event-actor"
import type { OperationalMotivo } from "@/lib/types/operational-control"
import type { Task } from "@/lib/types/tasks"
import type { TaskRescheduleInput } from "@/lib/tasks/reschedule"
import type { TaskOperationalEventInsert } from "@/lib/types/operational-control"
import { formatTreasuryPaymentMethodLabel } from "@/lib/tesoreria/ot-rendition-payment"

export const DEFAULT_CANCELACION_MOTIVO_OPTIONS = [
  { value: "cliente-solicito", label: "Cliente solicitó cancelación" },
  { value: "cliente-ausente", label: "Cliente ausente / no contactable" },
  { value: "sin-acceso", label: "Sin acceso al domicilio" },
  { value: "material-no-disponible", label: "Material no disponible" },
  { value: "condiciones-tecnicas", label: "Condiciones técnicas impeditivas" },
  { value: "duplicada", label: "Orden duplicada / error de carga" },
  { value: "otro", label: "Otro" },
] as const

export function motivoOptionsFromCatalog(
  items: OperationalMotivo[],
  fallback: ReadonlyArray<{ value: string; label: string }>
): Array<{ value: string; label: string }> {
  const active = items
    .filter((item) => item.isActive)
    .map((item) => ({ value: item.code, label: item.label }))

  if (active.length === 0) {
    return fallback.map((item) => ({ value: item.value, label: item.label }))
  }

  return active
}

export function resolveMotivoLabel(
  code: string | null | undefined,
  items: OperationalMotivo[]
): string {
  const trimmed = code?.trim()
  if (!trimmed) return "—"
  return items.find((item) => item.code === trimmed)?.label ?? trimmed
}

export function defaultRescheduleMotivoOptions(): Array<{
  value: string
  label: string
}> {
  return TASK_RESCHEDULE_REASONS.map((item) => ({
    value: item.value,
    label: item.label,
  }))
}

export function buildRescheduleOperationalEvent(input: {
  companyId: string
  task: Task
  reschedule: TaskRescheduleInput
  actor: OperationalEventActor
  motivoLabel?: string
}): TaskOperationalEventInsert {
  const previousDate = input.task.dueDate
  const previousTime = input.task.scheduledTime ?? null

  return applyOperationalEventActor(
    {
      companyId: input.companyId,
      taskId: input.task.id,
      eventType: "rescheduled",
      title: "Reprogramó la OT",
      description: `Reprogramada de ${previousDate} ${previousTime ?? ""} a ${input.reschedule.dueDate} ${input.reschedule.scheduledTime}`.trim(),
      observations: input.reschedule.notes?.trim() ?? "",
      payload: {
        previousDate,
        previousTime,
        newDate: input.reschedule.dueDate,
        newTime: input.reschedule.scheduledTime,
        reasonCode: input.reschedule.reason,
        reasonLabel: input.motivoLabel ?? input.reschedule.reason,
        notes: input.reschedule.notes?.trim() ?? "",
        crewId: input.reschedule.crewId ?? input.task.crewId ?? null,
        supervisor: input.reschedule.supervisor ?? input.task.supervisor ?? null,
      },
    },
    input.actor
  )
}

/**
 * Sprint OT Vencidas 1.0 — historial operativo al reprogramar desde vencida.
 * eventType: ot_reprogramada_por_vencimiento
 */
export function buildOverdueRescheduleOperationalEvent(input: {
  companyId: string
  task: Task
  reschedule: TaskRescheduleInput
  actor: OperationalEventActor
}): TaskOperationalEventInsert {
  const fechaOriginal = input.task.dueDate
  const nuevaFecha = input.reschedule.dueDate.trim()
  const motivo =
    input.reschedule.notes?.trim() || input.reschedule.reason.trim()

  return applyOperationalEventActor(
    {
      companyId: input.companyId,
      taskId: input.task.id,
      eventType: "ot_reprogramada_por_vencimiento",
      title: "OT reprogramada por vencimiento",
      description: `Reprogramada por vencimiento: ${fechaOriginal} → ${nuevaFecha}`,
      observations: motivo,
      payload: {
        task_id: input.task.id,
        fecha_original: fechaOriginal,
        nueva_fecha: nuevaFecha,
        motivo,
        usuario: input.actor.fullName,
        timestamp: new Date().toISOString(),
      },
    },
    input.actor
  )
}

export function buildOtRendidaOperationalEvent(input: {
  companyId: string
  taskId: string
  taskCode: string
  customerName: string
  crewName: string
  amount: number
  deliveredBy: string
  actor: OperationalEventActor
  paymentMethodExpected?: string | null
  paymentMethodReceived?: string | null
}): TaskOperationalEventInsert {
  const expected = formatTreasuryPaymentMethodLabel(input.paymentMethodExpected)
  const received = formatTreasuryPaymentMethodLabel(input.paymentMethodReceived)
  return applyOperationalEventActor(
    {
      companyId: input.companyId,
      taskId: input.taskId,
      eventType: "ot_rendida",
      title: "Rendición de Cobranza",
      description: `Rendición de Cobranza OT ${input.taskCode} · Esperado: ${expected} · Cobrado: ${received} · ${input.amount}`,
      observations: input.deliveredBy
        ? `Entrega: ${input.deliveredBy}`
        : "",
      payload: {
        ot: input.taskCode,
        task_id: input.taskId,
        cliente: input.customerName,
        cuadrilla: input.crewName,
        importe: input.amount,
        usuario_registro: input.actor.fullName,
        persona_entrega: input.deliveredBy || null,
        fecha_hora: new Date().toISOString(),
        payment_method_expected: input.paymentMethodExpected ?? null,
        payment_method_received: input.paymentMethodReceived ?? null,
      },
    },
    input.actor
  )
}

export function buildCancelOperationalEvent(input: {
  companyId: string
  task: Task
  reason: string
  observation: string
  actor: OperationalEventActor
  motivoLabel?: string
  relatedIncidentId?: string | null
}): TaskOperationalEventInsert {
  return applyOperationalEventActor(
    {
      companyId: input.companyId,
      taskId: input.task.id,
      eventType: "cancelled",
      title: "Canceló la OT",
      description: `Cancelada · ${input.motivoLabel ?? input.reason}`,
      observations: input.observation.trim(),
      payload: {
        previousStatus: input.task.status,
        reasonCode: input.reason,
        reasonLabel: input.motivoLabel ?? input.reason,
        notes: input.observation.trim(),
        supervisor: input.actor.fullName || input.task.supervisor || null,
        crewId: input.task.crewId ?? null,
        relatedIncidentId: input.relatedIncidentId ?? null,
      },
    },
    input.actor
  )
}
