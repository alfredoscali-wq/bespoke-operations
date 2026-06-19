import { getCrewAvailability } from "@/lib/crews/availability"
import type { CrewAvailabilityContext } from "@/lib/crews/availability"
import {
  CALENDAR_AVAILABILITY_LABELS,
  CALENDAR_CREW_STATUS_LABELS,
  getNotOperationalReason,
} from "@/lib/calendar/calendar-labels"
import {
  getWeekDays,
  getWeekEnd,
  getWeekSummaryReferenceDate,
} from "@/lib/calendar/calendar-utils"
import { isDateWithinRange } from "@/lib/availability/utils"
import { getEmployeeDisplayName } from "@/lib/employees/utils"
import type { EmployeeAvailability, AvailabilityType } from "@/lib/types/availability"
import type { CalendarEvent, CalendarWeekSummary } from "@/lib/types/calendar"
import type { Crew, CrewAvailabilityStatus } from "@/lib/types/crews"
import type { Employee } from "@/lib/types/employees"
import type { Task } from "@/lib/types/tasks"
import { isCalendarOperationalTask } from "@/lib/tasks/status-groups"

const ABSENCE_TYPES: AvailabilityType[] = [
  "VACATION",
  "SICK_LEAVE",
  "TRAINING",
  "LICENSE",
  "OTHER",
]

export type CalendarViewMode = "all" | "operations" | "rrhh" | "projects"

export type CalendarQuickFilters = {
  crewId: string
  crewStatus: string
  eventType: string
}

export const defaultCalendarQuickFilters: CalendarQuickFilters = {
  crewId: "all",
  crewStatus: "all",
  eventType: "all",
}

export type CalendarKpiKey = keyof CalendarWeekSummary

export type CalendarAbsenceDetail = {
  recordId: string
  employeeId: string
  employeeName: string
  employeeCode: string
  availabilityType: AvailabilityType
  startDate: string
  endDate: string
  crewNames: string[]
}

export type CalendarCrewDetail = {
  crewId: string
  crewName: string
  status: CrewAvailabilityStatus
  totalMembers: number
  availableMembers: number
  absentMembers: number
  reason?: string
}

export type CalendarTaskDetail = {
  taskId: string
  code: string
  title: string
  status: Task["status"]
  priority: Task["priority"]
  crewName: string
}

export type AbsenceOperationalImpact = {
  crewId: string
  crewName: string
  status: CrewAvailabilityStatus
  statusLabel: string
}

function rangesOverlapWeek(
  startDate: string,
  endDate: string,
  weekStart: string
): boolean {
  const weekEnd = getWeekEnd(weekStart)
  return startDate <= weekEnd && endDate >= weekStart
}

export function findEmployeeCrewNames(
  employeeId: string,
  crews: Crew[]
): string[] {
  return crews
    .filter((crew) =>
      crew.members.some(
        (member) => member.active && member.employeeId === employeeId
      )
    )
    .map((crew) => crew.name)
}

export function getAbsenceOperationalImpact(
  employeeId: string,
  crews: Crew[],
  context: CrewAvailabilityContext
): AbsenceOperationalImpact[] {
  return crews
    .filter((crew) =>
      crew.members.some(
        (member) => member.active && member.employeeId === employeeId
      )
    )
    .map((crew) => {
      const availability = getCrewAvailability(crew, context)
      return {
        crewId: crew.id,
        crewName: crew.name,
        status: availability.status,
        statusLabel: CALENDAR_CREW_STATUS_LABELS[availability.status],
      }
    })
}

export function getActiveAbsenceDetails(input: {
  availabilityRecords: EmployeeAvailability[]
  employees: Employee[]
  crews: Crew[]
  weekStart: string
}): CalendarAbsenceDetail[] {
  const weekDays = getWeekDays(input.weekStart)
  const seen = new Set<string>()

  return input.availabilityRecords
    .filter(
      (record) =>
        ABSENCE_TYPES.includes(record.availabilityType) &&
        weekDays.some((day) =>
          isDateWithinRange(day, record.startDate, record.endDate)
        )
    )
    .filter((record) => {
      if (seen.has(record.id)) return false
      seen.add(record.id)
      return true
    })
    .map((record) => {
      const employee = input.employees.find((item) => item.id === record.employeeId)
      const crewNames = findEmployeeCrewNames(record.employeeId, input.crews)

      return {
        recordId: record.id,
        employeeId: record.employeeId,
        employeeName: employee
          ? getEmployeeDisplayName(employee)
          : "Empleado desconocido",
        employeeCode: employee?.employeeCode ?? "—",
        availabilityType: record.availabilityType,
        startDate: record.startDate,
        endDate: record.endDate,
        crewNames,
      }
    })
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName, "es"))
}

export function getCrewDetailsByStatus(input: {
  crews: Crew[]
  context: CrewAvailabilityContext
  weekStart: string
  status: CrewAvailabilityStatus
}): CalendarCrewDetail[] {
  const referenceDate = getWeekSummaryReferenceDate(input.weekStart)
  const details: CalendarCrewDetail[] = []

  for (const crew of input.crews) {
    const availability = getCrewAvailability(crew, {
      ...input.context,
      referenceDate,
    })

    if (availability.status !== input.status) {
      continue
    }

    details.push({
      crewId: crew.id,
      crewName: crew.name,
      status: availability.status,
      totalMembers: availability.totalMembers,
      availableMembers: availability.availableMembers,
      absentMembers: availability.absentMembers,
      reason:
        input.status === "NOT_OPERATIONAL"
          ? getNotOperationalReason(availability)
          : undefined,
    })
  }

  return details.sort((a, b) => a.crewName.localeCompare(b.crewName, "es"))
}

export function getWeekTaskDetails(input: {
  tasks: Task[]
  weekStart: string
}): CalendarTaskDetail[] {
  return input.tasks
    .filter(
      (task) =>
        isCalendarOperationalTask(task.status) &&
        rangesOverlapWeek(task.startDate, task.dueDate, input.weekStart)
    )
    .map((task) => ({
      taskId: task.id,
      code: task.code,
      title: task.title,
      status: task.status,
      priority: task.priority,
      crewName: task.crew || "—",
    }))
    .sort((a, b) => a.code.localeCompare(b.code, "es"))
}

export function filterEventsForProjectsView(
  events: CalendarEvent[],
  tasks: Task[]
): CalendarEvent[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]))

  return events.filter((event) => {
    if (event.type !== "TASK") return false
    const task = taskById.get(event.payload.taskId)
    return Boolean(task?.projectId)
  })
}

export function filterEventsByQuickFilters(
  events: CalendarEvent[],
  filters: CalendarQuickFilters,
  tasks: Task[],
  crews: Crew[]
): CalendarEvent[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const crewMemberIds = new Map<string, Set<string>>()

  for (const crew of crews) {
    const ids = new Set<string>()
    for (const member of crew.members) {
      if (member.active && member.employeeId) {
        ids.add(member.employeeId)
      }
    }
    crewMemberIds.set(crew.id, ids)
  }

  return events.filter((event) => {
    if (filters.eventType !== "all" && event.type !== filters.eventType) {
      return false
    }

    if (filters.crewStatus !== "all" && event.type === "CREW_STATUS") {
      if (event.payload.status !== filters.crewStatus) {
        return false
      }
    }

    if (filters.crewId !== "all") {
      if (event.type === "CREW_STATUS") {
        return event.payload.crewId === filters.crewId
      }

      if (event.type === "TASK") {
        const task = taskById.get(event.payload.taskId)
        return task?.crewId === filters.crewId
      }

      if (event.type === "AVAILABILITY") {
        const memberIds = crewMemberIds.get(filters.crewId)
        return memberIds?.has(event.payload.employeeId) ?? false
      }
    }

    return true
  })
}

export function getCalendarViewFilters(viewMode: CalendarViewMode) {
  switch (viewMode) {
    case "operations":
      return {
        showTasks: true,
        showAvailability: false,
        showCrewStatus: true,
      }
    case "rrhh":
      return {
        showTasks: false,
        showAvailability: true,
        showCrewStatus: false,
      }
    case "projects":
      return {
        showTasks: true,
        showAvailability: false,
        showCrewStatus: false,
      }
    default:
      return {
        showTasks: true,
        showAvailability: true,
        showCrewStatus: true,
      }
  }
}

export function filterEventsByProjectId(
  events: CalendarEvent[],
  projectId: string | null | undefined,
  tasks: Task[],
  crews: Crew[]
): CalendarEvent[] {
  if (!projectId) return events

  const projectTasks = tasks.filter((task) => task.projectId === projectId)
  const projectTaskIds = new Set(projectTasks.map((task) => task.id))
  const projectCrewIds = new Set(
    projectTasks
      .map((task) => task.crewId)
      .filter((crewId): crewId is string => Boolean(crewId))
  )
  const projectEmployeeIds = new Set<string>()

  for (const crewId of projectCrewIds) {
    const crew = crews.find((item) => item.id === crewId)
    if (!crew) continue

    for (const member of crew.members) {
      if (member.active && member.employeeId) {
        projectEmployeeIds.add(member.employeeId)
      }
    }
  }

  return events.filter((event) => {
    if (event.type === "TASK") {
      return projectTaskIds.has(event.payload.taskId)
    }

    if (event.type === "CREW_STATUS") {
      return projectCrewIds.has(event.payload.crewId)
    }

    if (event.type === "AVAILABILITY") {
      return projectEmployeeIds.has(event.payload.employeeId)
    }

    return false
  })
}

export function getEventSubtitleLabel(event: CalendarEvent): string | undefined {
  if (event.type === "AVAILABILITY") {
    return CALENDAR_AVAILABILITY_LABELS[event.payload.availabilityType]
  }

  if (event.type === "CREW_STATUS") {
    return CALENDAR_CREW_STATUS_LABELS[event.payload.status]
  }

  return event.subtitle
}

export { CALENDAR_AVAILABILITY_LABELS, CALENDAR_CREW_STATUS_LABELS }
