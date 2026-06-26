import { compareDateOnly, toLocalDateOnly } from "@/lib/dates/date-only"
import {
  formatScheduledTimeForInput,
  getDefaultScheduledTime,
} from "@/lib/tasks/scheduling"
import type { Task, TaskStatus } from "@/lib/types/tasks"

export const VENCIDA_TASK_STATUS: TaskStatus = "vencida"

/**
 * Estados previos a la ejecución donde aplica el vencimiento automático por fecha.
 * Incluye OT programada sin cuadrilla (pendiente) y con cuadrilla (asignada).
 */
export const AUTO_VENCIDA_ELIGIBLE_STATUSES: TaskStatus[] = [
  "pendiente",
  "asignada",
]

export function isVencidaStatus(status: TaskStatus): boolean {
  return status === VENCIDA_TASK_STATUS
}

export function isTaskVencida(task: Pick<Task, "status">): boolean {
  return isVencidaStatus(task.status)
}

export function isAutoVencidaEligibleStatus(status: TaskStatus): boolean {
  return AUTO_VENCIDA_ELIGIBLE_STATUSES.includes(status)
}

export function isDueDateBeforeToday(
  dueDate: string | undefined | null,
  referenceDate: Date = new Date()
): boolean {
  const trimmed = dueDate?.trim()
  if (!trimmed) {
    return false
  }

  const today = toLocalDateOnly(referenceDate)
  return compareDateOnly(trimmed, today) < 0
}

/**
 * OT programada cuya fecha comprometida es anterior al día actual, sin haber iniciado
 * ejecución ni alcanzar un estado terminal. La cuadrilla no influye en el cálculo.
 * La hora programada no interviene en el vencimiento automático.
 */
export function isOverdueForAutoVencida(
  task: Pick<Task, "status" | "dueDate">,
  referenceDate: Date = new Date()
): boolean {
  if (!isAutoVencidaEligibleStatus(task.status)) {
    return false
  }

  return isDueDateBeforeToday(task.dueDate, referenceDate)
}

/** @deprecated Use isOverdueForAutoVencida */
export function isProgramadaDueDateExpired(
  task: Pick<Task, "status" | "dueDate">,
  referenceDate: Date = new Date()
): boolean {
  return isOverdueForAutoVencida(task, referenceDate)
}

/** @deprecated Prefer isOverdueForAutoVencida */
export function isProgramadaScheduleExpired(
  task: Pick<Task, "status" | "dueDate" | "scheduledTime">,
  referenceDate: Date = new Date()
): boolean {
  return isOverdueForAutoVencida(task, referenceDate)
}

/** OT programada, nunca iniciada, con fecha anterior al día actual. */
export function shouldAutoTransitionToVencida(task: Task): boolean {
  return isOverdueForAutoVencida(task)
}

export function taskHasAssignedCrew(
  task: Pick<Task, "crewId" | "crew">
): boolean {
  return Boolean(task.crewId || task.crew?.trim())
}

export function isVencidaWithoutCrew(
  task: Pick<Task, "status" | "crewId" | "crew">
): boolean {
  return isTaskVencida(task) && !taskHasAssignedCrew(task)
}

export function isVencidaWithCrew(
  task: Pick<Task, "status" | "crewId" | "crew">
): boolean {
  return isTaskVencida(task) && taskHasAssignedCrew(task)
}

/** Combina fecha y hora programada (solo ordenamiento de agenda y visualización). */
export function getTaskScheduledDateTime(
  task: Pick<Task, "dueDate" | "scheduledTime">,
  referenceDate: Date = new Date()
): Date {
  const [year, month, day] = task.dueDate.split("-").map(Number)
  const time =
    formatScheduledTimeForInput(task.scheduledTime) || getDefaultScheduledTime()
  const [hours, minutes] = time.split(":").map(Number)

  if (!year || !month || !day) {
    return referenceDate
  }

  return new Date(year, month - 1, day, hours ?? 0, minutes ?? 0, 0, 0)
}

export function validateRescheduleFromVencida(input: {
  dueDate: string
  scheduledTime?: string | null
  referenceDate?: Date
}): { allowed: boolean; message?: string } {
  const dueDate = input.dueDate.trim()
  if (!dueDate) {
    return { allowed: false, message: "Seleccione una nueva fecha." }
  }

  const today = toLocalDateOnly(input.referenceDate ?? new Date())

  if (compareDateOnly(dueDate, today) < 0) {
    return {
      allowed: false,
      message:
        "La nueva fecha programada ya venció. Elija el día de hoy o una fecha futura.",
    }
  }

  return { allowed: true }
}
