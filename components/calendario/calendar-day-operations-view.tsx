"use client"

import { CalendarEventCard } from "@/components/calendario/calendar-event-card"
import { useCalendar } from "@/components/calendario/calendar-provider"
import { useCalendarUI } from "@/components/calendario/calendar-ui-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { buildCalendarDayOperationsSections } from "@/lib/calendar/calendar-day-operations"
import { cn } from "@/lib/utils"

type CalendarDayOperationsViewProps = {
  date: string
}

export function CalendarDayOperationsView({ date }: CalendarDayOperationsViewProps) {
  const { selectEvent } = useCalendar()
  const { displayEventsByDate } = useCalendarUI()
  const { crews } = useCrews()

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

      {sections.map((section) => (
        <section
          key={section.crewKey}
          className={cn(
            "overflow-hidden rounded-xl border bg-card shadow-sm",
            section.crewId == null && "border-dashed"
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3">
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
                onClick={selectEvent}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
