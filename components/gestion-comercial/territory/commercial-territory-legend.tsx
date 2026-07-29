"use client"

import { cn } from "@/lib/utils"

export type CommercialEtiquetaLegendItem = {
  key: string
  shortName: string
  count: number
  color: { hex: string; soft: string }
}

type CommercialTerritoryLegendProps = {
  items: CommercialEtiquetaLegendItem[]
  className?: string
}

export function CommercialTerritoryLegend({
  items,
  className,
}: CommercialTerritoryLegendProps) {
  if (items.length === 0) return null

  return (
    <div
      className={cn(
        "pointer-events-none max-h-[40%] max-w-[220px] overflow-y-auto rounded-md border bg-background/95 px-2.5 py-2 shadow-sm backdrop-blur-sm",
        className
      )}
      role="list"
      aria-label="Leyenda de etiquetas comerciales"
    >
      <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        Etiquetas
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-center gap-2 text-xs text-foreground"
            role="listitem"
          >
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.color.hex }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">
              {item.shortName}
              <span className="text-muted-foreground"> ({item.count})</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
