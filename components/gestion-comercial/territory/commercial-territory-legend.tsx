"use client"

import { useState } from "react"
import { ChevronDown, Tags } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

export type CommercialEtiquetaLegendItem = {
  key: string
  shortName: string
  count: number
  color: { hex: string; soft: string }
}

type CommercialTerritoryLegendProps = {
  items: CommercialEtiquetaLegendItem[]
  selectedKeys: string[]
  onSelectedKeysChange: (keys: string[]) => void
  className?: string
}

export function CommercialTerritoryLegend({
  items,
  selectedKeys,
  onSelectedKeysChange,
  className,
}: CommercialTerritoryLegendProps) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null

  return (
    <div
      className={cn(
        "w-[220px] max-w-[calc(100%-1.5rem)]",
        className
      )}
    >
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 w-full justify-between bg-background/95 shadow-sm backdrop-blur-sm"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          <Tags className="size-3.5 shrink-0" />
          <span className="truncate">
            Etiquetas{selectedKeys.length ? ` (${selectedKeys.length})` : ""}
          </span>
        </span>
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
      </Button>

      {open ? (
        <div className="mt-1 max-h-[280px] overflow-y-auto rounded-md border bg-background/95 p-2 shadow-md backdrop-blur-sm">
          <ul className="space-y-1" aria-label="Filtrar por etiquetas">
            {items.map((item) => {
              const checked = selectedKeys.includes(item.key)
              return (
                <li key={item.key}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => {
                        onSelectedKeysChange(
                          value
                            ? [...selectedKeys, item.key]
                            : selectedKeys.filter((key) => key !== item.key)
                        )
                      }}
                    />
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color.hex }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {item.shortName}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {item.count}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          {selectedKeys.length > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="mt-1 h-7 w-full text-xs"
              onClick={() => onSelectedKeysChange([])}
            >
              Limpiar filtro
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
