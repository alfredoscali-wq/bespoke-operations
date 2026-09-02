"use client"

import {
  PLANNING_MAP_BASE_LAYER_OPTIONS,
  type PlanningMapSelectableBaseLayerId,
} from "@/lib/planificacion/planning-map-tiles"
import { cn } from "@/lib/utils"

type PlanningMapBaseLayerControlProps = {
  value: PlanningMapSelectableBaseLayerId
  onChange: (layerId: PlanningMapSelectableBaseLayerId) => void
}

export function PlanningMapBaseLayerControl({
  value,
  onChange,
}: PlanningMapBaseLayerControlProps) {
  return (
    <div
      className="absolute top-2 right-2 z-[1100]"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div
        role="group"
        aria-label="Capa del mapa"
        className="inline-flex rounded-md border bg-background/95 p-0.5 shadow-sm backdrop-blur"
      >
        {PLANNING_MAP_BASE_LAYER_OPTIONS.map((option) => {
          const selected = option.id === value

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              className={cn(
                "rounded px-2 py-1 text-xs font-medium transition-colors",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-muted"
              )}
              onClick={() => onChange(option.id)}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
