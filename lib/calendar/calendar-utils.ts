import { buildTaskAlertsForDate } from "@/lib/calendar/task-alerts"
import { getCrewAvailability } from "@/lib/crews/availability"
import type { CrewAvailabilityContext } from "@/lib/crews/availability"
import { isDateWithinRange, toDateOnly } from "@/lib/availability/utils"
import { getEmployeeDisplayName } from "@/lib/employees/utils"
import type { EmployeeAvailability, AvailabilityType } from "@/lib/types/availability"
import type {
  CalendarEvent,
  CalendarFilters,
  CalendarWeekDay,
  CalendarWeekSummary,
} from "@/lib/types/calendar"
import type { Crew } from "@/lib/types/crews"
import type { Employee } from "@/lib/types/employees"
import type { Task } from "@/lib/types/tasks"

const ABSENCE_TYPES: AvailabilityType[] = [
  "VACATION",
  "SICK_LEAVE",
  "TRAINING",
  "LICENSE",
  "OTHER",
]

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

export function addDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00`)
  next.setDate(next.getDate() + days)
  return next.toISOString().slice(0, 10)
}

export function getWeekStart(referenceDate: string = toDateOnly()): string {
  const date = new Date(`${referenceDate}T12:00:00`)
  const day = date.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + mondayOffset)
  return date.toISOString().slice(0, 10)
}

export function getWeekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
}

export function getWeekEnd(weekStart: string): string {
  return addDays(weekStart, 6)
}

export function shiftWeek(weekStart: string, weeks: number): string {
  return addDays(weekStart, weeks * 7)
}

export function buildCalendarWeekDays(weekStart: string): CalendarWeekDay[] {
  const today = toDateOnly()

  return getWeekDays(weekStart).map((date, index) => {
    const parsed = new Date(`${date}T12:00:00`)
    return {
      date,
      weekday: WEEKDAY_LABELS[index] ?? "",
      label: parsed.toLocaleDateString("es-AR", { day: "numeric" }),
      isToday: date === today,
    }
  })
}

export function formatWeekRangeLabel(weekStart: string): string {
  const weekEnd = getWeekEnd(weekStart)
  const start = new Date(`${weekStart}T12:00:00`)
  const end = new Date(`${weekEnd}T12:00:00`)
  const sameMonth = start.getMonth() === end.getMonth()

  const startLabel = start.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  })
  const endLabel = end.toLocaleDateString("es-AR", {
    day: "numeric",
    month: sameMonth ? undefined : "short",
    year: start.getFullYear() === end.getFullYear() ? undefined : "numeric",
  })

  return `${startLabel} – ${endLabel} ${end.getFullYear()}`
}

export function getWeekSummaryReferenceDate(weekStart: string): string {
  const today = toDateOnly()
  const weekEnd = getWeekEnd(weekStart)

  if (today >= weekStart && today <= weekEnd) {
    return today
  }

  return weekStart
}

function rangesOverlapWeek(
  startDate: string,
  endDate: string,
  weekStart: string
): boolean {
  const weekEnd = getWeekEnd(weekStart)
  return startDate <= weekEnd && endDate >= weekStart
}

function expandRangeToWeekDays(
  startDate: string,
  endDate: string,
  weekDays: string[]
): string[] {
  return weekDays.filter((day) => isDateWithinRange(day, startDate, endDate))
}

export function buildTaskCalendarEvents(
  tasks: Task[],
  weekStart: string,
  crews: Crew[],
  crewAvailabilityContext: CrewAvailabilityContext
): CalendarEvent[] {
  const weekDays = getWeekDays(weekStart)
  const weekEnd = getWeekEnd(weekStart)
  const events: CalendarEvent[] = []
  const crewAvailabilityCache = new Map<
    string,
    ReturnType<typeof getCrewAvailability>
  >()

  for (const task of tasks) {
    if (!rangesOverlapWeek(task.startDate, task.dueDate, weekStart)) {
      continue
    }

    const days = expandRangeToWeekDays(task.startDate, task.dueDate, weekDays)

    for (const date of days) {
      const alerts = buildTaskAlertsForDate({
        task,
        date,
        weekStart,
        weekEnd,
        crews,
        crewAvailabilityContext,
        crewAvailabilityCache,
      })

      events.push({
        id: `task-${task.id}-${date}`,
        type: "TASK",
        date,
        startDate: task.startDate,
        endDate: task.dueDate,
        title: task.title,
        subtitle: task.projectCode || task.customerCompany,
        payload: {
          taskId: task.id,
          code: task.code,
          title: task.title,
          projectCode: task.projectCode,
          projectName: task.projectName,
          customerCompany: task.customerCompany,
          customerName: task.customerName,
          serviceAddress: task.serviceAddress,
          status: task.status,
          priority: task.priority,
          startDate: task.startDate,
          dueDate: task.dueDate,
          alerts,
        },
      })
    }
  }

  return events
}

export function buildAvailabilityCalendarEvents(
  records: EmployeeAvailability[],
  employees: Employee[],
  weekStart: string
): CalendarEvent[] {
  const weekDays = getWeekDays(weekStart)
  const events: CalendarEvent[] = []

  for (const record of records) {
    if (!ABSENCE_TYPES.includes(record.availabilityType)) {
      continue
    }

    if (!rangesOverlapWeek(record.startDate, record.endDate, weekStart)) {
      continue
    }

    const employee = employees.find((item) => item.id === record.employeeId)
    const employeeName = employee
      ? getEmployeeDisplayName(employee)
      : "Empleado desconocido"
    const employeeCode = employee?.employeeCode ?? "—"
    const days = expandRangeToWeekDays(
      record.startDate,
      record.endDate,
      weekDays
    )

    for (const date of days) {
      events.push({
        id: `availability-${record.id}-${date}`,
        type: "AVAILABILITY",
        date,
        startDate: record.startDate,
        endDate: record.endDate,
        title: employeeName,
        subtitle: record.availabilityType,
        payload: {
          recordId: record.id,
          employeeId: record.employeeId,
          employeeName,
          employeeCode,
          availabilityType: record.availabilityType,
          startDate: record.startDate,
          endDate: record.endDate,
          reason: record.reason,
        },
      })
    }
  }

  return events
}

export function buildCrewStatusCalendarEvents(
  crews: Crew[],
  context: CrewAvailabilityContext,
  weekStart: string
): CalendarEvent[] {
  const weekDays = getWeekDays(weekStart)
  const events: CalendarEvent[] = []

  for (const crew of crews) {
    for (const date of weekDays) {
      const availability = getCrewAvailability(crew, {
        ...context,
        referenceDate: date,
      })

      events.push({
        id: `crew-${crew.id}-${date}`,
        type: "CREW_STATUS",
        date,
        startDate: date,
        endDate: date,
        title: crew.name,
        subtitle: availability.status,
        payload: {
          crewId: crew.id,
          crewName: crew.name,
          status: availability.status,
          totalMembers: availability.totalMembers,
          availableMembers: availability.availableMembers,
          absentMembers: availability.absentMembers,
          referenceDate: date,
        },
      })
    }
  }

  return events
}

export function buildCalendarEvents(input: {
  tasks: Task[]
  availabilityRecords: EmployeeAvailability[]
  employees: Employee[]
  crews: Crew[]
  crewAvailabilityContext: CrewAvailabilityContext
  weekStart: string
}): CalendarEvent[] {
  return [
    ...buildTaskCalendarEvents(
      input.tasks,
      input.weekStart,
      input.crews,
      input.crewAvailabilityContext
    ),
    ...buildAvailabilityCalendarEvents(
      input.availabilityRecords,
      input.employees,
      input.weekStart
    ),
    ...buildCrewStatusCalendarEvents(
      input.crews,
      input.crewAvailabilityContext,
      input.weekStart
    ),
  ]
}

export function filterCalendarEvents(
  events: CalendarEvent[],
  filters: CalendarFilters
): CalendarEvent[] {
  return events.filter((event) => {
    if (event.type === "TASK") return filters.showTasks
    if (event.type === "AVAILABILITY") return filters.showAvailability
    return filters.showCrewStatus
  })
}

export function groupEventsByDate(
  events: CalendarEvent[]
): Record<string, CalendarEvent[]> {
  return events.reduce<Record<string, CalendarEvent[]>>((groups, event) => {
    if (!groups[event.date]) {
      groups[event.date] = []
    }
    groups[event.date].push(event)
    return groups
  }, {})
}

export function getCalendarWeekSummary(input: {
  tasks: Task[]
  availabilityRecords: EmployeeAvailability[]
  crews: Crew[]
  crewAvailabilityContext: CrewAvailabilityContext
  weekStart: string
}): CalendarWeekSummary {
  const weekDays = getWeekDays(input.weekStart)
  const referenceDate = getWeekSummaryReferenceDate(input.weekStart)

  const tasksInWeek = input.tasks.filter((task) =>
    rangesOverlapWeek(task.startDate, task.dueDate, input.weekStart)
  ).length

  const activeAbsences = input.availabilityRecords.filter(
    (record) =>
      ABSENCE_TYPES.includes(record.availabilityType) &&
      weekDays.some((day) =>
        isDateWithinRange(day, record.startDate, record.endDate)
      )
  ).length

  const crewSummary = input.crews.map((crew) =>
    getCrewAvailability(crew, {
      ...input.crewAvailabilityContext,
      referenceDate,
    })
  )

  return {
    tasksInWeek,
    activeAbsences,
    operationalCrews: crewSummary.filter(
      (item) => item.status === "OPERATIONAL"
    ).length,
    reducedCrews: crewSummary.filter(
      (item) => item.status === "REDUCED_CAPACITY"
    ).length,
    notOperationalCrews: crewSummary.filter(
      (item) => item.status === "NOT_OPERATIONAL"
    ).length,
  }
}

export function sortCalendarEvents(events: CalendarEvent[]): CalendarEvent[] {
  const typeOrder = { TASK: 0, AVAILABILITY: 1, CREW_STATUS: 2 }

  return [...events].sort((a, b) => {
    const typeCompare = typeOrder[a.type] - typeOrder[b.type]
    if (typeCompare !== 0) return typeCompare
    return a.title.localeCompare(b.title, "es")
  })
}
