import type { AvailabilityType } from "@/lib/types/availability"
import type { CrewAvailabilityStatus } from "@/lib/types/crews"
import type { TaskPriority, TaskStatus } from "@/lib/types/tasks"

export type CalendarEventType = "TASK" | "AVAILABILITY" | "CREW_STATUS"

export type CalendarTaskAlertKind =
  | "CREW_REDUCED_CAPACITY"
  | "CREW_NOT_OPERATIONAL"
  | "MEMBER_ABSENT"
  | "DUE_THIS_WEEK"
  | "OVERDUE"

export type CalendarTaskAlertSeverity = "info" | "warning" | "critical"

export type CalendarTaskAlert = {
  kind: CalendarTaskAlertKind
  severity: CalendarTaskAlertSeverity
  message: string
  relatedCrewId?: string
  relatedEmployeeIds?: string[]
}

export type CalendarTaskPayload = {
  taskId: string
  code: string
  title: string
  projectCode: string
  projectName: string
  customerCompany?: string
  customerName?: string
  serviceAddress?: string
  status: TaskStatus
  priority: TaskPriority
  startDate: string
  dueDate: string
  scheduledTime?: string | null
  serviceType?: string | null
  crew?: string
  crewId?: string
  dispatchOrder?: number | null
  executionOrder?: number | null
  alerts: CalendarTaskAlert[]
}

export type CalendarAvailabilityPayload = {
  recordId: string
  employeeId: string
  employeeName: string
  employeeCode: string
  availabilityType: AvailabilityType
  startDate: string
  endDate: string
  reason?: string
}

export type CalendarCrewStatusPayload = {
  crewId: string
  crewName: string
  status: CrewAvailabilityStatus
  totalMembers: number
  availableMembers: number
  absentMembers: number
  referenceDate: string
}

export type CalendarEventBase = {
  id: string
  date: string
  startDate: string
  endDate: string
  title: string
  subtitle?: string
}

export type CalendarTaskEvent = CalendarEventBase & {
  type: "TASK"
  payload: CalendarTaskPayload
}

export type CalendarAvailabilityEvent = CalendarEventBase & {
  type: "AVAILABILITY"
  payload: CalendarAvailabilityPayload
}

export type CalendarCrewStatusEvent = CalendarEventBase & {
  type: "CREW_STATUS"
  payload: CalendarCrewStatusPayload
}

export type CalendarEvent =
  | CalendarTaskEvent
  | CalendarAvailabilityEvent
  | CalendarCrewStatusEvent

export type CalendarFilters = {
  showTasks: boolean
  showAvailability: boolean
  showCrewStatus: boolean
}

export const defaultCalendarFilters: CalendarFilters = {
  showTasks: true,
  showAvailability: true,
  showCrewStatus: true,
}

export type CalendarWeekSummary = {
  tasksInWeek: number
  activeAbsences: number
  operationalCrews: number
  reducedCrews: number
  notOperationalCrews: number
}

export type CalendarWeekDay = {
  date: string
  label: string
  weekday: string
  isToday: boolean
}
