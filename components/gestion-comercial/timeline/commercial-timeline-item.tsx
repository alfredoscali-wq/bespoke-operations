"use client"

import { Copy, Pencil, Trash2 } from "lucide-react"
import { useEffect, useRef } from "react"

import { CommercialTimelineContent } from "@/components/gestion-comercial/timeline/commercial-timeline-content"
import { CommercialTimelineIcon } from "@/components/gestion-comercial/timeline/commercial-timeline-icon"
import { Button } from "@/components/ui/button"
import type { CommercialActivityListItem } from "@/lib/types/commercial-activities"
import { cn } from "@/lib/utils"

type CommercialTimelineItemProps = {
  activity: CommercialActivityListItem
  isLast: boolean
  highlighted?: boolean
  onEdit: (activity: CommercialActivityListItem) => void
  onDelete: (activity: CommercialActivityListItem) => void
  onDuplicate: (activity: CommercialActivityListItem) => void
}

export function CommercialTimelineItem({
  activity,
  isLast,
  highlighted = false,
  onEdit,
  onDelete,
  onDuplicate,
}: CommercialTimelineItemProps) {
  const itemRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    if (!highlighted || !itemRef.current) return
    itemRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [highlighted])

  return (
    <li
      ref={itemRef}
      id={`commercial-activity-${activity.id}`}
      className={cn(
        "group relative flex gap-3 rounded-md py-2 pr-1 transition-colors md:gap-4",
        highlighted && "bg-primary/5 ring-1 ring-primary/20"
      )}
    >
      {!isLast ? (
        <span className="absolute top-10 bottom-0 left-[15px] w-px bg-border md:left-[17px]" />
      ) : null}

      <CommercialTimelineIcon typeCode={activity.activityTypeCode} />

      <div className="flex min-w-0 flex-1 items-start gap-2">
        <CommercialTimelineContent activity={activity} />

        <div
          className={cn(
            "flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100",
            "focus-within:opacity-100"
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Editar actividad"
            onClick={() => onEdit(activity)}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Duplicar actividad"
            onClick={() => onDuplicate(activity)}
          >
            <Copy className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive"
            aria-label="Eliminar actividad"
            onClick={() => onDelete(activity)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </li>
  )
}
