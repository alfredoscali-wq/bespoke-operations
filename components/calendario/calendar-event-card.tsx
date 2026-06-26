"use client"

import { AVAILABILITY_TYPE_LABELS } from "@/lib/availability/constants"
import {
  getCalendarTaskCustomerName,
  getCalendarTaskScheduledTimeLabel,
  getCalendarTaskWorkTypeLabel,
} from "@/lib/calendar/calendar-task-display"
import { getEventSubtitleLabel } from "@/lib/calendar/calendar-ui-utils"
import {
  countOperationalIncidents,
  resolveTaskOperationalTone,
} from "@/lib/calendar/task-alerts"
import { TASK_STATUS_LABELS } from "@/lib/tasks/constants"
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
    if (
      event.payload.status === "pendiente-cierre" ||
      event.payload.status === "en-aprobacion"
    ) {
      return CALENDAR_EVENT_TONE_STYLES.yellow
    }

    if (event.payload.status === "incidencia") {
      return CALENDAR_EVENT_TONE_STYLES.red
    }

    if (event.payload.status === "vencida") {
      return CALENDAR_EVENT_TONE_STYLES.red
    }

    if (event.payload.status === "en-curso") {
      return "border-orange-200/80 bg-orange-50/90 text-orange-900 hover:bg-orange-100/80 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-100"
    }

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

function CalendarTaskCardContent({
  event,
  alertCount,
}: {
  event: Extract<CalendarEvent, { type: "TASK" }>
  alertCount: number
}) {
  const scheduledTime = getCalendarTaskScheduledTimeLabel(event.payload)
  const customerName = getCalendarTaskCustomerName(event.payload)
  const workType = getCalendarTaskWorkTypeLabel(event.payload)
  const taskStatusLabel =
    event.payload.status === "pendiente-cierre"
      ? TASK_STATUS_LABELS["pendiente-cierre"]
      : event.payload.status === "incidencia"
        ? TASK_STATUS_LABELS.incidencia
        : event.payload.status === "vencida"
          ? TASK_STATUS_LABELS.vencida
          : null
  const taskStatusPrefix =
    event.payload.status === "incidencia" || event.payload.status === "vencida"
      ? "🔴 "
      : event.payload.status === "pendiente-cierre"
        ? "🟡 "
        : ""

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="sm:hidden">
            <p className="truncate text-xs font-semibold leading-snug">
              <span className="tabular-nums">{scheduledTime}</span>
              <span className="opacity-70"> • </span>
              <span>{customerName}</span>
            </p>
            <p className="truncate text-[11px] opacity-85">{workType}</p>
          </div>

          <div className="hidden space-y-0.5 sm:block">
            <p className="text-xs font-bold tabular-nums leading-snug">
              {scheduledTime}
            </p>
            <p className="truncate text-xs font-semibold uppercase leading-snug">
              {customerName}
            </p>
            <p className="truncate text-[11px] opacity-85">{workType}</p>
          </div>
        </div>

        {alertCount > 0 ? (
          <span
            className="shrink-0 text-[11px] font-semibold tabular-nums"
            aria-label={`${alertCount} incidencias operativas`}
          >
            ⚠ {alertCount}
          </span>
        ) : null}
      </div>

      {taskStatusLabel ? (
        <p className="mt-1 truncate text-[10px] font-semibold uppercase tracking-wide opacity-90">
          {taskStatusPrefix}
          {taskStatusLabel}
        </p>
      ) : null}
    </>
  )
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
      {isTask ? (
        <CalendarTaskCardContent event={event} alertCount={alertCount} />
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 flex-1 truncate text-xs font-semibold leading-snug">
              {event.title}
            </p>
          </div>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[11px] opacity-85">{subtitle}</p>
          ) : null}
          <p className="mt-1.5 truncate text-[10px] font-medium uppercase tracking-wide opacity-75">
            {getEventMeta(event)}
          </p>
        </>
      )}
    </button>
  )
}
