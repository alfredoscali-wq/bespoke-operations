"use client"

import { AVAILABILITY_TYPE_LABELS } from "@/lib/availability/constants"
import { CALENDAR_TASK_ALERT_LABELS } from "@/lib/calendar/calendar-labels"
import { getEventSubtitleLabel } from "@/lib/calendar/calendar-ui-utils"
import { CREW_AVAILABILITY_STATUS_LABELS } from "@/lib/crews/constants"
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/tasks/constants"
import type {
  CalendarEvent,
  CalendarTaskAlert,
  CalendarTaskAlertSeverity,
} from "@/lib/types/calendar"
import { CALENDAR_EVENT_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

type CalendarEventCardProps = {
  event: CalendarEvent
  onClick: (event: CalendarEvent) => void
}

const ALERT_BADGE_STYLES: Record<CalendarTaskAlertSeverity, string> = {
  info: "border-sky-200 bg-sky-50 text-sky-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  critical: "border-red-200 bg-red-50 text-red-800",
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

function TaskAlertBadges({ alerts }: { alerts: CalendarTaskAlert[] }) {
  if (alerts.length === 0) {
    return null
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {alerts.map((alert) => (
        <span
          key={alert.kind}
          className={cn(
            "inline-flex max-w-full items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-tight",
            ALERT_BADGE_STYLES[alert.severity]
          )}
        >
          <span aria-hidden className="mr-0.5 shrink-0">
            ⚠
          </span>
          <span className="truncate">{CALENDAR_TASK_ALERT_LABELS[alert.kind]}</span>
        </span>
      ))}
    </div>
  )
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
      {event.type === "TASK" ? (
        <TaskAlertBadges alerts={event.payload.alerts} />
      ) : null}
      <p className="mt-1.5 truncate text-[10px] font-medium uppercase tracking-wide opacity-75">
        {getEventMeta(event)}
      </p>
    </button>
  )
}
