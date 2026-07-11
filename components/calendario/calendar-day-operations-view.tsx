"use client"

import { useMemo } from "react"

import { CalendarEventCard } from "@/components/calendario/calendar-event-card"
import { useCalendar } from "@/components/calendario/calendar-provider"
import { useCalendarUI } from "@/components/calendario/calendar-ui-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { buildCalendarDayOperationsSections } from "@/lib/calendar/calendar-day-operations"
import {
  buildPlanningCrewColorIndex,
  PLANNING_CREW_PIN_COLORS,
  PLANNING_PIN_COLOR_NO_CREW,
} from "@/lib/planificacion/planning-map-markers"
import { cn } from "@/lib/utils"

type CalendarDayOperationsViewProps = {
  date: string
}

function resolveSectionCrewColor(
  crewId: string | null,
  crewColorIndex: Map<string, number>
): string {
  if (!crewId) {
    return PLANNING_PIN_COLOR_NO_CREW
  }

  const index = crewColorIndex.get(crewId)
  if (index === undefined) {
    return PLANNING_PIN_COLOR_NO_CREW
  }

  return PLANNING_CREW_PIN_COLORS[index % PLANNING_CREW_PIN_COLORS.length]
}

export function CalendarDayOperationsView({ date }: CalendarDayOperationsViewProps) {
  const { selectEvent } = useCalendar()
  const { displayEventsByDate } = useCalendarUI()
  const { crews } = useCrews()

  const crewIdsInOrder = useMemo(() => crews.map((crew) => crew.id), [crews])
  const crewColorIndex = useMemo(
    () => buildPlanningCrewColorIndex(crewIdsInOrder),
    [crewIdsInOrder]
  )

  const dayEvents = displayEventsByDate[date] ?? []
  const sections = buildCalendarDayOperationsSections(dayEvents, crews)
  const totalTasks = sections.reduce(
    (count, section) => count + section.events.length,
    0
  )

  if (totalTasks === 0) {
    return (
      <p className="rounded-xl border bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
        No hay órdenes de trabajo para este día con los filtros actuales.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {totalTasks} OT en la jornada · agrupadas por cuadrilla
      </p>

      {sections.map((section) => {
        const crewColor = resolveSectionCrewColor(
          section.crewId,
          crewColorIndex
        )

        return (
          <section
            key={section.crewKey}
            className={cn(
              "overflow-hidden rounded-xl border bg-card shadow-sm",
              section.crewId == null && "border-dashed"
            )}
          >
            <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3">
              <span
                className="inline-block h-8 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: crewColor }}
                aria-hidden
              />
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {section.crewName}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {section.events.length} OT
                </p>
              </div>
            </div>

            <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
              {section.events.map((event) => (
                <CalendarEventCard
                  key={event.id}
                  event={event}
                  density="dense"
                  crewAccentColor={
                    event.type === "TASK" ? crewColor : undefined
                  }
                  onClick={selectEvent}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
