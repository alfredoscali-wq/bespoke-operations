"use client"

import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  Palmtree,
  Users,
} from "lucide-react"

import { useCalendarUI } from "@/components/calendario/calendar-ui-provider"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"
import type { CalendarWeekSummary } from "@/lib/types/calendar"
import type { CalendarKpiKey } from "@/lib/calendar/calendar-ui-utils"
import type { VisualTone } from "@/lib/ui/visual-tokens"

type CalendarSummaryCardsProps = {
  summary: CalendarWeekSummary
}

const cards: {
  key: CalendarKpiKey
  label: string
  icon: typeof CheckSquare
  tone: VisualTone
}[] = [
  {
    key: "tasksInWeek",
    label: "Órdenes de trabajo de la semana",
    icon: CheckSquare,
    tone: "blue",
  },
  {
    key: "activeAbsences",
    label: "Ausencias activas",
    icon: Palmtree,
    tone: "red",
  },
  {
    key: "operationalCrews",
    label: "Cuadrillas operativas",
    icon: Users,
    tone: "green",
  },
  {
    key: "reducedCrews",
    label: "Cuadrillas reducidas",
    icon: AlertTriangle,
    tone: "yellow",
  },
  {
    key: "notOperationalCrews",
    label: "Cuadrillas no operativas",
    icon: CalendarDays,
    tone: "red",
  },
]

export function CalendarSummaryCards({ summary }: CalendarSummaryCardsProps) {
  const { selectedKpi, openKpiPanel } = useCalendarUI()

  return (
    <KpiCardGrid layout="calendar">
      {cards.map((card) => (
        <FilterableKpiCard
          key={card.key}
          label={card.label}
          value={summary[card.key]}
          icon={card.icon}
          tone={card.tone}
          isActive={selectedKpi === card.key}
          onClick={() => openKpiPanel(card.key)}
        />
      ))}
    </KpiCardGrid>
  )
}
