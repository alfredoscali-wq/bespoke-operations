"use client"

import { ChevronDown, ChevronUp } from "lucide-react"

import { useCalendarUI } from "@/components/calendario/calendar-ui-provider"
import { Button } from "@/components/ui/button"

const legendItems = [
  ({ emoji: "🔵", label: "Órdenes de Trabajo" }),
  { emoji: "🔴", label: "Vacaciones" },
  { emoji: "🟠", label: "Licencia médica" },
  { emoji: "🟡", label: "Capacidad reducida" },
  { emoji: "🟢", label: "Operativa" },
]

export function CalendarLegend() {
  const { legendVisible, setLegendVisible } = useCalendarUI()

  return (
    <div className="rounded-xl border bg-muted/20">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <p className="text-xs font-medium text-muted-foreground">
          Leyenda visual
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
          onClick={() => setLegendVisible(!legendVisible)}
        >
          {legendVisible ? "Ocultar" : "Mostrar"}
          {legendVisible ? (
            <ChevronUp className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </Button>
      </div>

      {legendVisible ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2 border-t px-4 py-3">
          {legendItems.map((item) => (
            <span
              key={item.label}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <span aria-hidden>{item.emoji}</span>
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
