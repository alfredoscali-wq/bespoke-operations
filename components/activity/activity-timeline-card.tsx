"use client"

import {
  formatActivityTimelineDate,
  formatActivityTimelineTime,
} from "@/lib/activity/activity-timeline-groups"
import type { ActivityTimelineEvent } from "@/lib/activity/activity-timeline-types"
import { formatActivityModuleLabel } from "@/lib/activity/activity-viewer-labels"
import { cn } from "@/lib/utils"

export function ActivityTimelineCard({
  event,
}: {
  event: ActivityTimelineEvent
}) {
  return (
    <article
      className={cn(
        "rounded-lg border bg-background px-4 py-3 shadow-sm",
        "transition-colors"
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium tabular-nums text-muted-foreground">
          {formatActivityTimelineTime(event.createdAt)}
          <span className="mx-1.5 text-border">·</span>
          {formatActivityTimelineDate(event.createdAt)}
        </p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {event.action}
        </p>
      </div>

      <h4 className="mt-1.5 text-sm font-semibold text-foreground">
        {event.title || event.action}
      </h4>

      {event.description ? (
        <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
      ) : null}

      <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Empleado</dt>
          <dd className="font-mono text-foreground">
            {event.employeeId ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Módulo</dt>
          <dd className="text-foreground">
            {formatActivityModuleLabel(event.module)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Entidad</dt>
          <dd className="text-foreground">
            {event.entityType}
            {event.entityId ? (
              <span className="font-mono text-muted-foreground">
                {" "}
                · {event.entityId}
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Acción</dt>
          <dd className="text-foreground">{event.action}</dd>
        </div>
      </dl>
    </article>
  )
}
