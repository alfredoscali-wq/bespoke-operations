"use client"

import { CommercialActivityStatusIcon } from "@/components/gestion-comercial/commercial-activity-icons"
import { Badge } from "@/components/ui/badge"
import {
  COMMERCIAL_ACTIVITY_STATUS_LABELS,
  COMMERCIAL_ACTIVITY_TYPE_LABELS,
} from "@/lib/commercial/activity-catalogs"
import {
  COMMERCIAL_ACTIVITY_TYPE_TONE,
  formatCommercialTimelineTime,
} from "@/lib/commercial/timeline"
import {
  displayCommercialValue,
  formatCommercialDateTime,
} from "@/lib/commercial/display"
import type { CommercialActivityListItem } from "@/lib/types/commercial-activities"
import { cn } from "@/lib/utils"

type CommercialTimelineContentProps = {
  activity: CommercialActivityListItem
}

export function CommercialTimelineContent({
  activity,
}: CommercialTimelineContentProps) {
  const tone = COMMERCIAL_ACTIVITY_TYPE_TONE[activity.activityTypeCode]

  return (
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="secondary"
          className={cn("border-transparent", tone.badge)}
        >
          {activity.activityTypeLabel ||
            COMMERCIAL_ACTIVITY_TYPE_LABELS[activity.activityTypeCode]}
        </Badge>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CommercialActivityStatusIcon status={activity.status} />
          {COMMERCIAL_ACTIVITY_STATUS_LABELS[activity.status]}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatCommercialTimelineTime(activity.createdAt)}
        </span>
      </div>

      <p className="text-sm font-medium leading-snug text-foreground">
        {activity.title}
      </p>

      {activity.description.trim() ? (
        <p className="text-sm leading-snug text-muted-foreground line-clamp-3">
          {activity.description}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {displayCommercialValue(activity.employeeName)}
      </p>

      {activity.scheduledAt ? (
        <p className="text-xs text-muted-foreground">
          Programada: {formatCommercialDateTime(activity.scheduledAt)}
        </p>
      ) : null}
    </div>
  )
}
