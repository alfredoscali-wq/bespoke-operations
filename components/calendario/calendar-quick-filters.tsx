"use client"

import { useMemo } from "react"

import { useCalendarUI } from "@/components/calendario/calendar-ui-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import {
  CALENDAR_CREW_STATUS_LABELS,
  CALENDAR_EVENT_TYPE_LABELS,
} from "@/lib/calendar/calendar-labels"
import {
  type CalendarQuickFilters,
} from "@/lib/calendar/calendar-ui-utils"
import {
  QuickFilterBar,
  QuickFilterField,
} from "@/components/ui/quick-filter-bar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type CalendarQuickFiltersBarProps = {
  filters: CalendarQuickFilters
  onChange: (filters: CalendarQuickFilters) => void
}

export function CalendarQuickFiltersBar({
  filters,
  onChange,
}: CalendarQuickFiltersBarProps) {
  const { viewMode } = useCalendarUI()
  const { crews } = useCrews()

  const eventTypeOptions = useMemo(() => {
    const all = [
      { value: "all", label: "Todos los tipos" },
      { value: "TASK", label: CALENDAR_EVENT_TYPE_LABELS.TASK },
      { value: "AVAILABILITY", label: CALENDAR_EVENT_TYPE_LABELS.AVAILABILITY },
      { value: "CREW_STATUS", label: CALENDAR_EVENT_TYPE_LABELS.CREW_STATUS },
    ]

    if (viewMode === "operations") {
      return all.filter((item) =>
        ["all", "TASK", "CREW_STATUS"].includes(item.value)
      )
    }

    if (viewMode === "rrhh") {
      return all.filter((item) => ["all", "AVAILABILITY"].includes(item.value))
    }

    if (viewMode === "projects") {
      return all.filter((item) => ["all", "TASK"].includes(item.value))
    }

    return all
  }, [viewMode])

  function update<K extends keyof CalendarQuickFilters>(
    key: K,
    value: CalendarQuickFilters[K]
  ) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <QuickFilterBar>
      <QuickFilterField label="Cuadrilla">
        <Select
          value={filters.crewId}
          onValueChange={(value) => update("crewId", value)}
        >
          <SelectTrigger className="w-full bg-background">
            <SelectValue placeholder="Todas las cuadrillas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las cuadrillas</SelectItem>
            {[...crews]
              .sort((a, b) => a.name.localeCompare(b.name, "es"))
              .map((crew) => (
                <SelectItem key={crew.id} value={crew.id}>
                  {crew.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </QuickFilterField>

      <QuickFilterField label="Estado operativo">
        <Select
          value={filters.crewStatus}
          onValueChange={(value) => update("crewStatus", value)}
        >
          <SelectTrigger className="w-full bg-background">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(CALENDAR_CREW_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </QuickFilterField>

      <QuickFilterField label="Tipo de evento">
        <Select
          value={filters.eventType}
          onValueChange={(value) => update("eventType", value)}
        >
          <SelectTrigger className="w-full bg-background">
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            {eventTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </QuickFilterField>
    </QuickFilterBar>
  )
}
