import { getCurrentAvailabilityStatus } from "@/lib/availability/utils"
import {
  getCrewAvailability,
  type CrewAvailabilityContext,
} from "@/lib/crews/availability"
import { getEmployeeDisplayName, isEmployeeAvailable } from "@/lib/employees/utils"
import type {
  CalendarTaskAlert,
  CalendarTaskAlertKind,
  CalendarTaskAlertSeverity,
} from "@/lib/types/calendar"
import { FINAL_TASK_STATUSES } from "@/lib/tasks/status-groups"
import type { Crew, CrewMember } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"

const ALERT_SEVERITY: Record<CalendarTaskAlertKind, CalendarTaskAlertSeverity> =
  {
    CREW_REDUCED_CAPACITY: "warning",
    CREW_NOT_OPERATIONAL: "critical",
    MEMBER_ABSENT: "warning",
    DUE_THIS_WEEK: "info",
    OVERDUE: "critical",
  }

function isMemberAbsentOnDate(
  member: CrewMember,
  context: CrewAvailabilityContext,
  referenceDate: string
): boolean {
  if (!member.active || !member.employeeId) {
    return false
  }

  const employee = context.getEmployee?.(member.employeeId)
  if (employee && !isEmployeeAvailable(employee)) {
    return true
  }

  return (
    getCurrentAvailabilityStatus(
      member.employeeId,
      context.availabilityRecords,
      referenceDate
    ) !== "AVAILABLE"
  )
}

function getAbsentMembersOnDate(
  crew: Crew,
  context: CrewAvailabilityContext,
  referenceDate: string
): { employeeId: string; employeeName: string }[] {
  const dateContext: CrewAvailabilityContext = {
    ...context,
    referenceDate,
  }

  return crew.members
    .filter((member) => isMemberAbsentOnDate(member, dateContext, referenceDate))
    .map((member) => {
      const employee = context.getEmployee?.(member.employeeId!)
      return {
        employeeId: member.employeeId!,
        employeeName: employee
          ? getEmployeeDisplayName(employee)
          : member.name || "Integrante",
      }
    })
}

export function buildTaskAlertsForDate(input: {
  task: Task
  date: string
  weekStart: string
  weekEnd: string
  crews: Crew[]
  crewAvailabilityContext: CrewAvailabilityContext
  crewAvailabilityCache?: Map<string, ReturnType<typeof getCrewAvailability>>
}): CalendarTaskAlert[] {
  const {
    task,
    date,
    crews,
    crewAvailabilityContext,
    crewAvailabilityCache,
  } = input

  const alerts: CalendarTaskAlert[] = []
  const isFinal = FINAL_TASK_STATUSES.includes(task.status)

  if (task.status === "vencida" && !isFinal) {
    alerts.push({
      kind: "OVERDUE",
      severity: ALERT_SEVERITY.OVERDUE,
      message: "Orden de trabajo vencida. Debe reprogramarse antes de iniciarse.",
    })
  }

  if (!task.crewId) {
    return alerts
  }

  const crew = crews.find((item) => item.id === task.crewId)
  if (!crew) {
    return alerts
  }

  const cacheKey = `${crew.id}:${date}`
  let crewAvailability = crewAvailabilityCache?.get(cacheKey)

  if (!crewAvailability) {
    crewAvailability = getCrewAvailability(crew, {
      ...crewAvailabilityContext,
      referenceDate: date,
    })
    crewAvailabilityCache?.set(cacheKey, crewAvailability)
  }

  if (crewAvailability.status === "NOT_OPERATIONAL") {
    alerts.push({
      kind: "CREW_NOT_OPERATIONAL",
      severity: ALERT_SEVERITY.CREW_NOT_OPERATIONAL,
      message: `La cuadrilla ${crew.name} no está operativa el ${date}.`,
      relatedCrewId: crew.id,
    })
  } else if (crewAvailability.status === "REDUCED_CAPACITY") {
    alerts.push({
      kind: "CREW_REDUCED_CAPACITY",
      severity: ALERT_SEVERITY.CREW_REDUCED_CAPACITY,
      message: `La cuadrilla ${crew.name} opera con capacidad reducida (${crewAvailability.availableMembers}/${crewAvailability.totalMembers} disponibles).`,
      relatedCrewId: crew.id,
    })
  }

  const absentMembers = getAbsentMembersOnDate(
    crew,
    crewAvailabilityContext,
    date
  )

  if (absentMembers.length > 0) {
    const names = absentMembers.map((member) => member.employeeName).join(", ")
    alerts.push({
      kind: "MEMBER_ABSENT",
      severity: ALERT_SEVERITY.MEMBER_ABSENT,
      message: `Personal ausente: ${names}.`,
      relatedCrewId: crew.id,
      relatedEmployeeIds: absentMembers.map((member) => member.employeeId),
    })
  }

  return alerts
}

/** Alerts that affect TASK card color and incident counter (excludes informational). */
export function getOperationalIncidentAlerts(
  alerts: CalendarTaskAlert[]
): CalendarTaskAlert[] {
  return alerts.filter((alert) => alert.kind !== "DUE_THIS_WEEK")
}

export function resolveTaskOperationalTone(
  alerts: CalendarTaskAlert[]
): "green" | "yellow" | "red" {
  const operational = getOperationalIncidentAlerts(alerts)

  if (operational.some((alert) => alert.severity === "critical")) {
    return "red"
  }
  if (operational.length > 0) {
    return "yellow"
  }
  return "green"
}

export function countOperationalIncidents(alerts: CalendarTaskAlert[]): number {
  return getOperationalIncidentAlerts(alerts).length
}
