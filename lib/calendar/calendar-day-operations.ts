import { compareScheduledTimeStrings } from "@/lib/tasks/scheduling"
import {
  compareTasksByDispatchRoute,
  formatDispatchOrderBadge,
  resolveTaskRouteOrder,
} from "@/lib/tasks/dispatch-order"
import type { Crew } from "@/lib/types/crews"
import type {
  CalendarEvent,
  CalendarTaskEvent,
  CalendarTaskPayload,
} from "@/lib/types/calendar"
import type { Task } from "@/lib/types/tasks"

export const CALENDAR_WEEK_MAX_VISIBLE_EVENTS = 12

export const CALENDAR_NO_CREW_GROUP_KEY = "__no_crew__"

export const CALENDAR_NO_CREW_GROUP_LABEL = "Sin cuadrilla asignada"

export type CalendarDayOperationsSection = {
  crewKey: string
  crewId: string | null
  crewName: string
  events: CalendarTaskEvent[]
}

function toRouteComparableTask(payload: CalendarTaskPayload): Pick<
  Task,
  | "dueDate"
  | "crew"
  | "crewId"
  | "dispatchOrder"
  | "executionOrder"
  | "status"
  | "createdAt"
> {
  return {
    dueDate: payload.dueDate,
    crew: payload.crew ?? "",
    crewId: payload.crewId,
    dispatchOrder: payload.dispatchOrder,
    executionOrder: payload.executionOrder,
    status: payload.status,
    createdAt: "",
  }
}

export function isCalendarTaskEvent(
  event: CalendarEvent
): event is CalendarTaskEvent {
  return event.type === "TASK"
}

export function sortCalendarTaskEventsByRouteOrder(
  events: CalendarTaskEvent[]
): CalendarTaskEvent[] {
  return [...events].sort((left, right) => {
    const byRoute = compareTasksByDispatchRoute(
      toRouteComparableTask(left.payload) as Task,
      toRouteComparableTask(right.payload) as Task
    )

    if (byRoute !== 0) {
      return byRoute
    }

    return compareScheduledTimeStrings(
      left.payload.scheduledTime,
      right.payload.scheduledTime
    )
  })
}

export function resolveCalendarTaskRouteOrderLabel(
  payload: CalendarTaskPayload
): string | null {
  return formatDispatchOrderBadge(
    resolveTaskRouteOrder(toRouteComparableTask(payload) as Task)
  )
}

export function buildCalendarDayOperationsSections(
  events: CalendarEvent[],
  crews: Pick<Crew, "id" | "name">[] = []
): CalendarDayOperationsSection[] {
  const taskEvents = events.filter(isCalendarTaskEvent)
  const grouped = new Map<string, CalendarTaskEvent[]>()

  for (const event of taskEvents) {
    const crewKey = event.payload.crewId ?? CALENDAR_NO_CREW_GROUP_KEY
    const current = grouped.get(crewKey) ?? []
    current.push(event)
    grouped.set(crewKey, current)
  }

  const crewNameById = new Map(crews.map((crew) => [crew.id, crew.name]))
  const sections: CalendarDayOperationsSection[] = []

  for (const crew of crews) {
    const crewEvents = grouped.get(crew.id)
    if (!crewEvents?.length) {
      continue
    }

    sections.push({
      crewKey: crew.id,
      crewId: crew.id,
      crewName: crew.name,
      events: sortCalendarTaskEventsByRouteOrder(crewEvents),
    })
  }

  const orphanCrewIds = [...grouped.keys()].filter(
    (crewKey) =>
      crewKey !== CALENDAR_NO_CREW_GROUP_KEY && !crewNameById.has(crewKey)
  )

  for (const crewKey of orphanCrewIds.sort((left, right) =>
    left.localeCompare(right, "es")
  )) {
    const crewEvents = grouped.get(crewKey)
    if (!crewEvents?.length) {
      continue
    }

    sections.push({
      crewKey,
      crewId: crewKey,
      crewName: crewEvents[0]?.payload.crew ?? crewKey,
      events: sortCalendarTaskEventsByRouteOrder(crewEvents),
    })
  }

  const unassignedEvents = grouped.get(CALENDAR_NO_CREW_GROUP_KEY)
  if (unassignedEvents?.length) {
    sections.push({
      crewKey: CALENDAR_NO_CREW_GROUP_KEY,
      crewId: null,
      crewName: CALENDAR_NO_CREW_GROUP_LABEL,
      events: sortCalendarTaskEventsByRouteOrder(unassignedEvents),
    })
  }

  return sections
}
