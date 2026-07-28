import {
  formatScheduledTimeForInput,
  getDefaultScheduledTime,
  normalizeScheduledTimeForDb,
} from "@/lib/tasks/scheduling"
import {
  validateRescheduleFromVencida,
} from "@/lib/tasks/vencida-status"
import type { Task } from "@/lib/types/tasks"
import type { UpdateTaskPayload } from "@/lib/types/supabase/tasks"

export type TaskRescheduleReason =
  | "cliente-solicito"
  | "cuadrilla-no-disponible"
  | "clima"
  | "material-no-disponible"
  | "conflicto-agenda"
  | "error-planificacion"
  | "otro"

export const TASK_RESCHEDULE_REASONS: {
  value: TaskRescheduleReason
  label: string
}[] = [
  { value: "cliente-solicito", label: "Cliente solicitó reprogramación" },
  { value: "cuadrilla-no-disponible", label: "Cuadrilla no disponible" },
  { value: "clima", label: "Condiciones climáticas" },
  { value: "material-no-disponible", label: "Material no disponible" },
  { value: "conflicto-agenda", label: "Conflicto de agenda" },
  { value: "error-planificacion", label: "Error de planificación" },
  { value: "otro", label: "Otro" },
]

export const TASK_RESCHEDULE_REASON_LABELS: Record<
  TaskRescheduleReason,
  string
> = Object.fromEntries(
  TASK_RESCHEDULE_REASONS.map((item) => [item.value, item.label])
) as Record<TaskRescheduleReason, string>

export const TASK_RESCHEDULE_SAME_SCHEDULE_MESSAGE =
  "La nueva programación debe ser distinta de la programación actual."

export const TASK_RESCHEDULE_PAST_SCHEDULE_MESSAGE =
  "No puede reprogramar una Orden de Trabajo para una fecha u hora pasada."

export function resolveRescheduleReasonLabel(
  reason: string | null | undefined
): string {
  const trimmed = reason?.trim()
  if (!trimmed) return "—"

  return (
    TASK_RESCHEDULE_REASON_LABELS[trimmed as TaskRescheduleReason] ?? trimmed
  )
}

export type TaskRescheduleInput = {
  dueDate: string
  scheduledTime: string
  reason: string
  notes?: string
  crewId?: string | null
  crew?: string
  supervisor?: string
  rescheduledBy: string
}

export type TaskRescheduleCurrentSchedule = Pick<
  Task,
  "dueDate" | "scheduledTime"
>

function normalizeScheduleKey(
  dueDate: string,
  scheduledTime: string | null | undefined
): string {
  const dateKey = dueDate.trim()
  const timeKey =
    formatScheduledTimeForInput(scheduledTime) || getDefaultScheduledTime()
  return `${dateKey}|${timeKey}`
}

/**
 * Business rules for OT reschedule (shared by dialogs, client mutations, server).
 * Does not mutate state; callers must abort when `allowed` is false.
 */
export function validateTaskRescheduleInput(
  input: Pick<TaskRescheduleInput, "dueDate" | "scheduledTime" | "reason">,
  options?: {
    referenceDate?: Date
    current?: TaskRescheduleCurrentSchedule | null
  }
): { allowed: boolean; message?: string } {
  const referenceDate = options?.referenceDate ?? new Date()
  const dueDate = input.dueDate.trim()
  const scheduledTime = input.scheduledTime.trim()

  if (!dueDate) {
    return { allowed: false, message: "Seleccione una nueva fecha." }
  }

  if (!scheduledTime) {
    return { allowed: false, message: "Indique la hora programada." }
  }

  if (!input.reason.trim()) {
    return { allowed: false, message: "Seleccione un motivo de reprogramación." }
  }

  const current = options?.current
  if (current?.dueDate?.trim()) {
    const nextKey = normalizeScheduleKey(dueDate, scheduledTime)
    const currentKey = normalizeScheduleKey(
      current.dueDate,
      current.scheduledTime
    )
    if (nextKey === currentKey) {
      return {
        allowed: false,
        message: TASK_RESCHEDULE_SAME_SCHEDULE_MESSAGE,
      }
    }
  }

  const pastValidation = validateRescheduleFromVencida({
    dueDate,
    scheduledTime,
    referenceDate,
  })
  if (!pastValidation.allowed) {
    return {
      allowed: false,
      message:
        pastValidation.message ?? TASK_RESCHEDULE_PAST_SCHEDULE_MESSAGE,
    }
  }

  return { allowed: true }
}

export function buildTaskRescheduleUpdatePayload(
  task: Task,
  input: TaskRescheduleInput,
  targetStatus: Task["status"]
): UpdateTaskPayload {
  const dueDate = input.dueDate.trim()
  const scheduledTime = normalizeScheduledTimeForDb(input.scheduledTime)
  const rescheduledAt = new Date().toISOString()
  const shouldPreserveOriginal = !task.originalScheduledDate?.trim()

  const payload: UpdateTaskPayload = {
    status: targetStatus,
    dueDate,
    startDate: dueDate,
    scheduledTime,
    rescheduledBy: input.rescheduledBy.trim(),
    rescheduledAt,
    rescheduleReason: input.reason.trim(),
    rescheduleNotes: input.notes?.trim() || "",
  }

  if (shouldPreserveOriginal) {
    payload.originalScheduledDate = task.dueDate
    payload.originalScheduledTime = task.scheduledTime ?? null
  }

  if (input.crewId !== undefined) {
    payload.crewId = input.crewId
    payload.crew = input.crew?.trim() ?? ""
    if (input.supervisor !== undefined) {
      payload.supervisor = input.supervisor
    }
  }

  return payload
}

export function buildTaskRescheduleHistoryNote(input: TaskRescheduleInput): string {
  const timeLabel =
    formatScheduledTimeForInput(input.scheduledTime) || getDefaultScheduledTime()
  const reasonLabel = resolveRescheduleReasonLabel(input.reason)
  const notes = input.notes?.trim()

  const parts = [
    `Nueva programación: ${input.dueDate.trim()} ${timeLabel}.`,
    `Motivo: ${reasonLabel}.`,
  ]

  if (notes) {
    parts.push(`Observación: ${notes}`)
  }

  if (input.crewId !== undefined && input.crew?.trim()) {
    parts.push(`Cuadrilla: ${input.crew.trim()}.`)
  }

  return parts.join(" ")
}

export function getTaskRescheduleFormDefaults(task: Task) {
  return {
    dueDate: task.dueDate,
    scheduledTime:
      formatScheduledTimeForInput(task.scheduledTime) || getDefaultScheduledTime(),
    crewId: task.crewId ?? "",
  }
}
