"use client"

import { CommercialTimelineDate } from "@/components/gestion-comercial/timeline/commercial-timeline-date"
import { CommercialTimelineItem } from "@/components/gestion-comercial/timeline/commercial-timeline-item"
import type { CommercialTimelineDateGroup } from "@/lib/commercial/timeline"
import type { CommercialActivityListItem } from "@/lib/types/commercial-activities"

type CommercialTimelineGroupProps = {
  group: CommercialTimelineDateGroup
  highlightedActivityId?: string | null
  onEdit: (activity: CommercialActivityListItem) => void
  onDelete: (activity: CommercialActivityListItem) => void
  onDuplicate: (activity: CommercialActivityListItem) => void
}

export function CommercialTimelineGroup({
  group,
  highlightedActivityId,
  onEdit,
  onDelete,
  onDuplicate,
}: CommercialTimelineGroupProps) {
  return (
    <section className="space-y-2 md:space-y-3">
      <CommercialTimelineDate label={group.label} />
      <ul className="space-y-1 md:space-y-2">
        {group.activities.map((activity, index) => (
          <CommercialTimelineItem
            key={activity.id}
            activity={activity}
            isLast={index === group.activities.length - 1}
            highlighted={highlightedActivityId === activity.id}
            onEdit={onEdit}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
          />
        ))}
      </ul>
    </section>
  )
}
