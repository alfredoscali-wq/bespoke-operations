"use client"

import { DispatchOrderBadge } from "@/components/tareas/dispatch-order-badge"
import { AVAILABILITY_TYPE_LABELS } from "@/lib/availability/constants"
import {
  getCalendarTaskCustomerName,
  getCalendarTaskScheduledTimeLabel,
  getCalendarTaskWorkTypeLabel,
} from "@/lib/calendar/calendar-task-display"
import { resolveCalendarTaskRouteOrderLabel } from "@/lib/calendar/calendar-day-operations"
import { getEventSubtitleLabel } from "@/lib/calendar/calendar-ui-utils"
import { countOperationalIncidents } from "@/lib/calendar/task-alerts"
import { TASK_STATUS_LABELS } from "@/lib/tasks/constants"
import { getTaskStatusCalendarEventClass } from "@/lib/tasks/status-visual"
import { CREW_AVAILABILITY_STATUS_LABELS } from "@/lib/crews/constants"
import type { CalendarEvent } from "@/lib/types/calendar"
import { CALENDAR_EVENT_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

type CalendarEventCardProps = {
  event: CalendarEvent
  density?: "default" | "dense"
  crewAccentColor?: string
  onClick: (event: CalendarEvent) => void
}

function getEventStyles(event: CalendarEvent): string {
  if (event.type === "TASK") {
    return getTaskStatusCalendarEventClass(event.payload.status)
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

function resolveCriticalStatusAbbreviation(
  event: Extract<CalendarEvent, { type: "TASK" }>
): string | null {
  if (event.payload.status === "pendiente-cierre") {
    return "PC"
  }

  if (event.payload.status === "incidencia") {
    return "INC"
  }

  if (event.payload.status === "vencida") {
    return "VNC"
  }

  return null
}

function CalendarTaskCardContent({
  event,
  alertCount,
  density,
}: {
  event: Extract<CalendarEvent, { type: "TASK" }>
  alertCount: number
  density: "default" | "dense"
}) {
  const scheduledTime = getCalendarTaskScheduledTimeLabel(event.payload)
  const customerName = getCalendarTaskCustomerName(event.payload)
  const workType = getCalendarTaskWorkTypeLabel(event.payload)
  const routeTask = {
    dispatchOrder: event.payload.dispatchOrder,
    executionOrder: event.payload.executionOrder,
  }
  const routeOrderLabel = resolveCalendarTaskRouteOrderLabel(event.payload)
  const criticalAbbreviation = resolveCriticalStatusAbbreviation(event)
  const taskStatusLabel =
    event.payload.status === "pendiente-cierre"
      ? TASK_STATUS_LABELS["pendiente-cierre"]
      : event.payload.status === "incidencia"
        ? TASK_STATUS_LABELS.incidencia
        : event.payload.status === "vencida"
          ? TASK_STATUS_LABELS.vencida
          : null

  if (density === "dense") {
    return (
      <div className="flex items-center gap-1.5">
        {routeOrderLabel ? (
          <span
            className="shrink-0 rounded border border-primary/20 bg-primary/10 px-1 py-0.5 text-[10px] font-semibold leading-none text-primary tabular-nums"
            aria-label={`Orden operativo ${routeOrderLabel}`}
          >
            {routeOrderLabel}
          </span>
        ) : null}

        <p className="min-w-0 flex-1 truncate text-[11px] leading-snug">
          {scheduledTime ? (
            <>
              <span className="font-semibold tabular-nums">{scheduledTime}</span>
              <span className="opacity-60"> · </span>
            </>
          ) : null}
          <span className="font-medium">{customerName}</span>
          <span className="opacity-60"> · </span>
          <span className="opacity-85">{workType}</span>
        </p>

        {criticalAbbreviation ? (
          <span
            className="shrink-0 rounded bg-background/70 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide"
            title={taskStatusLabel ?? criticalAbbreviation}
          >
            {criticalAbbreviation}
          </span>
        ) : null}

        {alertCount > 0 ? (
          <span
            className="shrink-0 text-[10px] font-semibold tabular-nums"
            aria-label={`${alertCount} incidencias operativas`}
          >
            ⚠{alertCount}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <DispatchOrderBadge task={routeTask} size="sm" />
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
          {taskStatusLabel}
        </p>
      ) : null}
    </>
  )
}

export function CalendarEventCard({
  event,
  density = "default",
  crewAccentColor,
  onClick,
}: CalendarEventCardProps) {
  const isTask = event.type === "TASK"
  const subtitle = !isTask ? getEventSubtitleLabel(event) : undefined
  const alertCount = isTask
    ? countOperationalIncidents(event.payload.alerts)
    : 0
  const isDense = density === "dense"

  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      className={cn(
        "w-full rounded-lg border text-left shadow-sm transition-colors",
        isDense ? "px-2 py-1.5" : "px-3 py-2.5",
        crewAccentColor && "border-l-[3px]",
        getEventStyles(event)
      )}
      style={
        crewAccentColor
          ? { borderLeftColor: crewAccentColor }
          : undefined
      }
    >
      {isTask ? (
        <CalendarTaskCardContent
          event={event}
          alertCount={alertCount}
          density={density}
        />
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                "min-w-0 flex-1 truncate font-semibold leading-snug",
                isDense ? "text-[11px]" : "text-xs"
              )}
            >
              {event.title}
            </p>
          </div>
          {subtitle ? (
            <p
              className={cn(
                "truncate opacity-85",
                isDense ? "text-[10px]" : "mt-0.5 text-[11px]"
              )}
            >
              {subtitle}
            </p>
          ) : null}
          <p
            className={cn(
              "truncate font-medium uppercase tracking-wide opacity-75",
              isDense ? "mt-0.5 text-[9px]" : "mt-1.5 text-[10px]"
            )}
          >
            {getEventMeta(event)}
          </p>
        </>
      )}
    </button>
  )
}
