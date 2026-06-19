import type { AvailabilityType } from "@/lib/types/availability"
import type { CrewAvailabilityStatus } from "@/lib/types/crews"
import type { CalendarEventType, CalendarTaskAlertKind } from "@/lib/types/calendar"

/** Human-readable labels for calendar UI (no technical enum codes). */
export const CALENDAR_AVAILABILITY_LABELS: Record<AvailabilityType, string> = {
  AVAILABLE: "Disponible",
  VACATION: "Vacaciones",
  SICK_LEAVE: "Licencia médica",
  TRAINING: "Capacitación",
  LICENSE: "Licencia",
  OTHER: "No disponible",
}

export const CALENDAR_CREW_STATUS_LABELS: Record<
  CrewAvailabilityStatus,
  string
> = {
  OPERATIONAL: "Operativa",
  REDUCED_CAPACITY: "Capacidad reducida",
  NOT_OPERATIONAL: "No operativa",
}

export const CALENDAR_EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  TASK: "Tareas",
  AVAILABILITY: "Ausencias",
  CREW_STATUS: "Cuadrillas",
}

export const CALENDAR_TASK_ALERT_LABELS: Record<CalendarTaskAlertKind, string> = {
  CREW_REDUCED_CAPACITY: "Cuadrilla reducida",
  CREW_NOT_OPERATIONAL: "Cuadrilla no operativa",
  MEMBER_ABSENT: "Personal ausente",
  DUE_THIS_WEEK: "Vence esta semana",
  OVERDUE: "Tarea vencida",
}

export function getNotOperationalReason(input: {
  totalMembers: number
  availableMembers: number
  absentMembers: number
}): string {
  if (input.totalMembers === 0) {
    return "Sin integrantes activos en la cuadrilla"
  }

  if (input.availableMembers === 0) {
    return "Ningún integrante disponible operativamente"
  }

  return "Capacidad insuficiente para operar"
}
