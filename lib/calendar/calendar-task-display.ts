import { formatScheduledTimeDisplay } from "@/lib/tasks/scheduling"
import { getWorkOrderServiceTypeLabel } from "@/lib/tasks/work-order"
import type { CalendarTaskPayload } from "@/lib/types/calendar"

export function getCalendarTaskScheduledTimeLabel(
  payload: Pick<CalendarTaskPayload, "scheduledTime">
): string {
  return formatScheduledTimeDisplay(payload.scheduledTime) ?? "—"
}

export function getCalendarTaskCustomerName(
  payload: Pick<CalendarTaskPayload, "customerName" | "projectName">
): string {
  return (
    payload.customerName?.trim() ||
    payload.projectName?.trim() ||
    "Sin cliente"
  )
}

export function getCalendarTaskWorkTypeLabel(
  payload: Pick<CalendarTaskPayload, "serviceType" | "title">
): string {
  return (
    getWorkOrderServiceTypeLabel(payload.serviceType) ??
    (payload.title.trim() || "Orden de Trabajo")
  )
}
