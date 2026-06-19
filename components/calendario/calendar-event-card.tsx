"use client"

import { AVAILABILITY_TYPE_LABELS } from "@/lib/availability/constants"
import { getEventSubtitleLabel } from "@/lib/calendar/calendar-ui-utils"
import {
  countOperationalIncidents,
  resolveTaskOperationalTone,
} from "@/lib/calendar/task-alerts"
import { CREW_AVAILABILITY_STATUS_LABELS } from "@/lib/crews/constants"
import type { CalendarEvent } from "@/lib/types/calendar"
import { CALENDAR_EVENT_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

type CalendarEventCardProps = {
  event: CalendarEvent
  onClick: (event: CalendarEvent) => void
}

function getEventStyles(event: CalendarEvent): string {
  if (event.type === "TASK") {
    return CALENDAR_EVENT_TONE_STYLES[
      resolveTaskOperationalTone(event.payload.alerts)
    ]
  }

  if (event.type === "AVAILABILITY") {
    const { availabilityType } = event.payload
    const styles: Record<string, string> = {
      VACATION: CALENDAR_EVENT_TONE_STYLES.red,
      SICK_LEAVE: CALENDAR_EVENT_TONE_STYLES.yellow,
      TRAINING: CALENDAR_EVENT_TONE_STYLES.yellow,
      LICENSE: CALENDAR_EVENT_TONE_STYLES.blue,
      OTHER: CALENDAR_EVENT_TONE_STYLES.gray,
    }

    return styles[availabilityType] ?? CALENDAR_EVENT_TONE_STYLES.gray
  }

  const { status } = event.payload
  const crewStyles: Record<string, string> = {
    OPERATIONAL: CALENDAR_EVENT_TONE_STYLES.green,
    REDUCED_CAPACITY: CALENDAR_EVENT_TONE_STYLES.yellow,
    NOT_OPERATIONAL: CALENDAR_EVENT_TONE_STYLES.red,
  }

  return crewStyles[status] ?? CALENDAR_EVENT_TONE_STYLES.gray
}

function getEventMeta(event: CalendarEvent): string {
  if (event.type === "AVAILABILITY") {
    return AVAILABILITY_TYPE_LABELS[event.payload.availabilityType]
  }

  if (event.type === "CREW_STATUS") {
    return CREW_AVAILABILITY_STATUS_LABELS[event.payload.status]
  }

  return ""
}

export function CalendarEventCard({ event, onClick }: CalendarEventCardProps) {
  const isTask = event.type === "TASK"
  const subtitle = !isTask ? getEventSubtitleLabel(event) : undefined
  const alertCount = isTask
    ? countOperationalIncidents(event.payload.alerts)
    : 0

  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      className={cn(
        "w-full rounded-lg border px-3 py-2.5 text-left shadow-sm transition-colors",
        getEventStyles(event)
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-xs font-semibold leading-snug">
          {event.title}
        </p>
        {isTask && alertCount > 0 ? (
          <span
            className="shrink-0 text-[11px] font-semibold tabular-nums"
            aria-label={`${alertCount} incidencias operativas`}
          >
            ⚠ {alertCount}
          </span>
        ) : null}
      </div>
      {subtitle ? (
        <p className="mt-0.5 truncate text-[11px] opacity-85">{subtitle}</p>
      ) : null}
      {!isTask ? (
        <p className="mt-1.5 truncate text-[10px] font-medium uppercase tracking-wide opacity-75">
          {getEventMeta(event)}
        </p>
      ) : null}
    </button>
  )
}
