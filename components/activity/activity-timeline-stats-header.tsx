"use client"

import {
  formatActivityTimelineDate,
  formatActivityTimelineTime,
} from "@/lib/activity/activity-timeline-groups"
import type { ActivityTimelineStats } from "@/lib/activity/activity-timeline-types"

type ActivityTimelineStatsHeaderProps = {
  stats: ActivityTimelineStats
  isLoading?: boolean
}

function formatStamp(value: string | null): string {
  if (!value) return "—"
  return `${formatActivityTimelineDate(value)} ${formatActivityTimelineTime(value)}`
}

export function ActivityTimelineStatsHeader({
  stats,
  isLoading = false,
}: ActivityTimelineStatsHeaderProps) {
  return (
    <div className="grid gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm sm:grid-cols-3">
      <div>
        <p className="text-xs text-muted-foreground">Eventos registrados</p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums">
          {isLoading ? "…" : stats.total}
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Primer evento</p>
        <p className="mt-0.5 text-sm font-medium">
          {isLoading ? "…" : formatStamp(stats.firstEventAt)}
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Último evento</p>
        <p className="mt-0.5 text-sm font-medium">
          {isLoading ? "…" : formatStamp(stats.lastEventAt)}
        </p>
      </div>
    </div>
  )
}
