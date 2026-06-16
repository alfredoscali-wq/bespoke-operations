"use client"

import { AVAILABILITY_TYPE_LABELS } from "@/lib/availability/constants"
import { CREW_AVAILABILITY_STATUS_LABELS } from "@/lib/crews/constants"
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/tasks/constants"
import { getEventSubtitleLabel } from "@/lib/calendar/calendar-ui-utils"
import type { CalendarEvent } from "@/lib/types/calendar"
import { CALENDAR_EVENT_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

type CalendarEventCardProps = {
  event: CalendarEvent
  onClick: (event: CalendarEvent) => void
}

function getEventStyles(event: CalendarEvent): string {
  if (event.type === "TASK") {
    return CALENDAR_EVENT_TONE_STYLES.blue
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
  if (event.type === "TASK") {
    const { status, priority } = event.payload
    return `${TASK_STATUS_LABELS[status]} · ${TASK_PRIORITY_LABELS[priority]}`
  }

  if (event.type === "AVAILABILITY") {
    return AVAILABILITY_TYPE_LABELS[event.payload.availabilityType]
  }

  return CREW_AVAILABILITY_STATUS_LABELS[event.payload.status]
}

export function CalendarEventCard({ event, onClick }: CalendarEventCardProps) {
  const subtitle = getEventSubtitleLabel(event)

  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      className={cn(
        "w-full rounded-lg border px-3 py-2.5 text-left shadow-sm transition-colors",
        getEventStyles(event)
      )}
    >
      <p className="truncate text-xs font-semibold leading-snug">{event.title}</p>
      {subtitle ? (
        <p className="mt-0.5 truncate text-[11px] opacity-85">{subtitle}</p>
      ) : null}
      <p className="mt-1.5 truncate text-[10px] font-medium uppercase tracking-wide opacity-75">
        {getEventMeta(event)}
      </p>
    </button>
  )
}
