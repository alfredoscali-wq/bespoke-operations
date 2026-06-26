"use client"

import {
  AlertTriangle,
  CalendarDays,
  CheckSquare,
  Palmtree,
  Users,
} from "lucide-react"

import { useCalendarUI } from "@/components/calendario/calendar-ui-provider"
import type { CalendarWeekSummary } from "@/lib/types/calendar"
import type { CalendarKpiKey } from "@/lib/calendar/calendar-ui-utils"
import type { VisualTone } from "@/lib/ui/visual-tokens"
import { KpiCard } from "@/components/ui/kpi-card"
import { cn } from "@/lib/utils"

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
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => {
        const isActive = selectedKpi === card.key

        return (
          <button
            key={card.key}
            type="button"
            onClick={() => openKpiPanel(card.key)}
            className={cn(
              "rounded-xl text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              isActive && "ring-2 ring-primary/25"
            )}
          >
            <KpiCard
              label={card.label}
              value={summary[card.key]}
              icon={card.icon}
              tone={card.tone}
              className={cn(
                "h-full cursor-pointer transition-shadow hover:shadow-md",
                isActive && "shadow-md"
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
