"use client"

import { useEffect, useMemo, useState } from "react"

import { EntityActivityTimeline } from "@/components/activity/entity-activity-timeline"
import { ExecutiveBriefView } from "@/components/executive/executive-brief-view"
import { drainAnalysisTimelineEvents } from "@/lib/analysis/queries/drain-timeline-events"
import type {
  ActivityTimelineEvent,
  ActivityTimelineScope,
  ActivityTimelineVisibleFilters,
} from "@/lib/activity/activity-timeline-types"
import { todayDateInputValue } from "@/lib/activity/employee-daily-report"
import { buildExecutiveBrief, type ExecutiveBriefScope } from "@/lib/executive"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

async function fetchAllScopedDayEvents(
  scope: ActivityTimelineScope,
  date: string
): Promise<
  | { success: true; items: ActivityTimelineEvent[] }
  | { success: false; message: string }
> {
  try {
    const items = await drainAnalysisTimelineEvents({
      scope,
      dateFromInput: date,
      dateToInput: date,
    })
    return { success: true, items }
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo cargar la actividad del día.",
    }
  }
}

function toBriefScope(
  timelineScope: ActivityTimelineScope,
  label?: string
): ExecutiveBriefScope {
  if (timelineScope.kind === "employee") {
    return { kind: "employee", id: timelineScope.employeeId, label }
  }
  if (timelineScope.kind === "entity") {
    const kind =
      timelineScope.entityType === "crew"
        ? "crew"
        : timelineScope.entityType === "project"
          ? "project"
          : timelineScope.entityType === "customer"
            ? "customer"
            : "company"
    return {
      kind,
      id: timelineScope.entityId,
      label,
    }
  }
  return { kind: "company", label }
}

export function EntityProductionView({
  timelineScope,
  timelineFilters,
  title = "Producción",
  subtitle = "Resumen → Producción → Detalle → Timeline",
  entityLabel,
  initialDate,
}: {
  timelineScope: ActivityTimelineScope
  timelineFilters: ActivityTimelineVisibleFilters
  title?: string
  subtitle?: string
  entityLabel?: string
  initialDate?: string
}) {
  const [date, setDate] = useState(
    () => initialDate?.trim() || todayDateInputValue()
  )
  const [dayItems, setDayItems] = useState<ActivityTimelineEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const scopeKey = useMemo(() => {
    if (timelineScope.kind === "employee") {
      return `employee:${timelineScope.employeeId}`
    }
    if (timelineScope.kind === "entity") {
      return `entity:${timelineScope.entityType}:${timelineScope.entityId}:${timelineScope.module ?? ""}`
    }
    return "global"
  }, [timelineScope])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      await Promise.resolve()
      if (cancelled) return
      setIsLoading(true)
      setError(null)

      const result = await fetchAllScopedDayEvents(timelineScope, date)
      if (cancelled) return

      if (!result.success) {
        setError(result.message)
        setDayItems([])
        setIsLoading(false)
        return
      }

      setDayItems(result.items)
      setIsLoading(false)
    })()

    return () => {
      cancelled = true
    }
    // scopeKey captures timeline identity; timelineScope read from closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable scope key
  }, [date, scopeKey])

  const brief = useMemo(() => {
    if (dayItems.length === 0 && !isLoading) {
      return buildExecutiveBrief({
        scope: toBriefScope(timelineScope, entityLabel),
        date,
        events: [],
      })
    }
    if (dayItems.length === 0) return null
    return buildExecutiveBrief({
      scope: toBriefScope(timelineScope, entityLabel),
      date,
      events: dayItems,
    })
  }, [date, dayItems, entityLabel, isLoading, timelineScope])

  const dateKey =
    timelineScope.kind === "employee"
      ? timelineScope.employeeId
      : timelineScope.kind === "entity"
        ? `${timelineScope.entityType}:${timelineScope.entityId}`
        : "global"

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`entity-production-date-${dateKey}`}>Fecha</Label>
          <Input
            id={`entity-production-date-${dateKey}`}
            type="date"
            className="h-9 w-[11.5rem] bg-background"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <ExecutiveBriefView
        brief={brief}
        isLoading={isLoading}
        showRelevantActivity
        showOperationalState
      />

      <section className="space-y-2 border-t pt-6">
        <div>
          <h3 className="text-sm font-semibold">Timeline</h3>
          <p className="text-xs text-muted-foreground">
            Evidencia · auditoría de la jornada
          </p>
        </div>
        <EntityActivityTimeline
          key={`${dateKey}:${date}`}
          scope={timelineScope}
          visibleFilters={timelineFilters}
          layout="embedded"
          showStats={false}
          order="ASC"
          groupByDay={false}
          showInterEventGaps
          lockedDate={date}
          className="min-h-0"
          feedClassName="max-h-[560px]"
        />
      </section>
    </div>
  )
}
