import { TASK_RESCHEDULE_REASONS } from "@/lib/tasks/reschedule"
import type { OperationalEventActor } from "@/lib/tasks/operational-event-actor"
import { applyOperationalEventActor } from "@/lib/tasks/operational-event-actor"
import type { OperationalMotivo } from "@/lib/types/operational-control"
import type { Task } from "@/lib/types/tasks"
import type { TaskRescheduleInput } from "@/lib/tasks/reschedule"
import type { TaskOperationalEventInsert } from "@/lib/types/operational-control"

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
