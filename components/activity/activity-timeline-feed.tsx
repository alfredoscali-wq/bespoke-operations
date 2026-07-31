"use client"

import { Loader2 } from "lucide-react"
import type { RefObject } from "react"

import { ActivityTimelineCard } from "@/components/activity/activity-timeline-card"
import {
  ACTIVITY_TIMELINE_GROUP_LABELS,
  type ActivityTimelineEvent,
} from "@/lib/activity/activity-timeline-types"
import { groupActivityTimelineEvents } from "@/lib/activity/activity-timeline-groups"
import { formatActivityInterEventGap } from "@/lib/activity/employee-daily-report"

type ActivityTimelineFeedProps = {
  items: ActivityTimelineEvent[]
  isLoading: boolean
  isLoadingMore: boolean
  hasMore: boolean
  error: string | null
  scrollRootRef: RefObject<HTMLDivElement | null>
  sentinelRef: RefObject<HTMLDivElement | null>
  className?: string
  groupByDay?: boolean
  showInterEventGaps?: boolean
}

export function ActivityTimelineFeed({
  items,
  isLoading,
  isLoadingMore,
  hasMore,
  error,
  scrollRootRef,
  sentinelRef,
  className,
  groupByDay = true,
  showInterEventGaps = false,
}: ActivityTimelineFeedProps) {
  const grouped = groupByDay ? groupActivityTimelineEvents(items) : null

  return (
    <div ref={scrollRootRef} className={className}>
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando timeline…
        </div>
      ) : null}

      {!isLoading && !error && items.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          No hay eventos para los filtros seleccionados.
        </div>
      ) : null}

      {!isLoading && items.length > 0 && grouped ? (
        <div className="space-y-6">
          {grouped.map((section) => (
            <div key={section.id} className="space-y-3">
              <h3 className="sticky top-0 z-10 -mx-1 bg-card/95 px-1 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                {ACTIVITY_TIMELINE_GROUP_LABELS[section.id]}
              </h3>
              <EventList
                items={section.items}
                showInterEventGaps={showInterEventGaps}
              />
            </div>
          ))}

          <div ref={sentinelRef} className="h-8 w-full" aria-hidden />

          {isLoadingMore ? (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando más…
            </div>
          ) : null}

          {!hasMore ? (
            <p className="pb-2 text-center text-xs text-muted-foreground">
              Fin del timeline
            </p>
          ) : null}
        </div>
      ) : null}

      {!isLoading && items.length > 0 && !grouped ? (
        <div className="space-y-3">
          <EventList items={items} showInterEventGaps={showInterEventGaps} />
          <div ref={sentinelRef} className="h-8 w-full" aria-hidden />
          {isLoadingMore ? (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando más…
            </div>
          ) : null}
          {!hasMore ? (
            <p className="pb-2 text-center text-xs text-muted-foreground">
              Fin de la jornada
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function EventList({
  items,
  showInterEventGaps,
}: {
  items: ActivityTimelineEvent[]
  showInterEventGaps: boolean
}) {
  return (
    <ul className="space-y-3">
      {items.map((event, index) => {
        const previous = index > 0 ? items[index - 1] : null
        const gapLabel =
          showInterEventGaps && previous
            ? formatActivityInterEventGap(previous.createdAt, event.createdAt)
            : null

        return (
          <li key={event.id} className="space-y-3">
            {gapLabel ? (
              <div className="flex flex-col items-center gap-1 py-1 text-xs text-muted-foreground">
                <span aria-hidden>↓</span>
                <span className="rounded-full border bg-muted/40 px-2.5 py-0.5 font-medium">
                  {gapLabel}
                </span>
                <span aria-hidden>↓</span>
              </div>
            ) : null}
            <ActivityTimelineCard event={event} />
          </li>
        )
      })}
    </ul>
  )
}
