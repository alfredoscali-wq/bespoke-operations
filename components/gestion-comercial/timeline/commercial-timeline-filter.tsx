"use client"

import { Button } from "@/components/ui/button"
import {
  COMMERCIAL_TIMELINE_FILTERS,
  type CommercialTimelineFilter,
} from "@/lib/commercial/timeline"
import { cn } from "@/lib/utils"

type CommercialTimelineFilterProps = {
  value: CommercialTimelineFilter
  onChange: (value: CommercialTimelineFilter) => void
}

export function CommercialTimelineFilterBar({
  value,
  onChange,
}: CommercialTimelineFilterProps) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COMMERCIAL_TIMELINE_FILTERS.map((filter) => {
        const active = value === filter.id
        return (
          <Button
            key={filter.id}
            type="button"
            size="sm"
            variant={active ? "secondary" : "outline"}
            className={cn("h-7 px-2.5 text-xs", active && "font-semibold")}
            onClick={() => onChange(filter.id)}
          >
            {filter.label}
          </Button>
        )
      })}
    </div>
  )
}
