"use client"

import { cn } from "@/lib/utils"
import type { CalendarViewMode } from "@/lib/calendar/calendar-ui-utils"
import { Button } from "@/components/ui/button"

const views: { value: CalendarViewMode; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "operations", label: "Operaciones" },
  { value: "rrhh", label: "RRHH" },
  { value: "projects", label: "Obras" },
]

type CalendarViewSelectorProps = {
  value: CalendarViewMode
  onChange: (value: CalendarViewMode) => void
  className?: string
}

export function CalendarViewSelector({
  value,
  onChange,
  className,
}: CalendarViewSelectorProps) {
  return (
    <div
      className={cn(
        "inline-flex flex-wrap gap-1 rounded-xl border bg-muted/30 p-1",
        className
      )}
    >
      {views.map((view) => (
        <Button
          key={view.value}
          type="button"
          size="sm"
          variant={value === view.value ? "default" : "ghost"}
          className={cn(
            "h-8 rounded-lg px-3 text-xs font-semibold uppercase tracking-wide",
            value !== view.value && "text-muted-foreground"
          )}
          onClick={() => onChange(view.value)}
        >
          {view.label}
        </Button>
      ))}
    </div>
  )
}
