"use client"

import { useState } from "react"

import { CalendarEventCard } from "@/components/calendario/calendar-event-card"
import { useCalendarUI } from "@/components/calendario/calendar-ui-provider"
import { useCalendar } from "@/components/calendario/calendar-provider"
import { CALENDAR_WEEK_MAX_VISIBLE_EVENTS } from "@/lib/calendar/calendar-day-operations"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function CalendarWeekView() {
  const { weekDays, selectEvent } = useCalendar()
  const { displayEventsByDate } = useCalendarUI()
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({})

  function toggleDay(date: string) {
    setExpandedDays((current) => ({
      ...current,
      [date]: !current[date],
    }))
  }

  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid min-w-[1024px] grid-cols-7 gap-2">
        {weekDays.map((day) => {
          const dayEvents = displayEventsByDate[day.date] ?? []
          const isExpanded = expandedDays[day.date]
          const visibleEvents = isExpanded
            ? dayEvents
            : dayEvents.slice(0, CALENDAR_WEEK_MAX_VISIBLE_EVENTS)
          const hiddenCount = dayEvents.length - visibleEvents.length

          return (
            <div
              key={day.date}
              className={cn(
                "min-h-[320px] rounded-xl border bg-card shadow-sm",
                day.isToday && "border-primary/40 ring-1 ring-primary/15"
              )}
            >
              <div
                className={cn(
                  "border-b px-3 py-2.5",
                  day.isToday && "bg-primary/[0.04]"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {day.weekday}
                    </p>
                    <p className="mt-0.5 text-lg font-semibold tabular-nums">
                      {day.label}
                    </p>
                  </div>
                  {dayEvents.length > 0 ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {dayEvents.length}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="space-y-1.5 p-2">
                {dayEvents.length === 0 ? (
                  <p className="px-1 py-6 text-center text-[11px] text-muted-foreground">
                    Sin eventos
                  </p>
                ) : (
                  <>
                    {visibleEvents.map((event) => (
                      <CalendarEventCard
                        key={event.id}
                        event={event}
                        density="dense"
                        onClick={selectEvent}
                      />
                    ))}

                    {hiddenCount > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-full text-[11px] text-muted-foreground"
                        onClick={() => toggleDay(day.date)}
                      >
                        {isExpanded
                          ? "Ver menos"
                          : `Ver ${hiddenCount} más`}
                      </Button>
                    ) : null}

                    {isExpanded &&
                    dayEvents.length > CALENDAR_WEEK_MAX_VISIBLE_EVENTS ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-full text-[11px] text-muted-foreground"
                        onClick={() => toggleDay(day.date)}
                      >
                        Ver menos
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
