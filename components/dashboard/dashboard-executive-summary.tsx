import {
  AlertTriangle,
  ClipboardList,
  Radio,
  TowerControl,
} from "lucide-react"

import type { DashboardExecutiveKpi } from "@/lib/data/dashboard"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"

const EXECUTIVE_ICONS = {
  "active-projects": TowerControl,
  "pending-tasks": ClipboardList,
  "operational-crews": Radio,
  "operational-alerts": AlertTriangle,
} as const

const EXECUTIVE_TONES = {
  "active-projects": "blue",
  "pending-tasks": "yellow",
  "operational-crews": "green",
  "operational-alerts": "red",
} as const

type DashboardExecutiveSummaryProps = {
  kpis: DashboardExecutiveKpi[]
}

export function DashboardExecutiveSummary({
  kpis,
}: DashboardExecutiveSummaryProps) {
  return (
    <KpiCardGrid layout="standard">
      {kpis.map((kpi) => {
        const Icon = EXECUTIVE_ICONS[kpi.id as keyof typeof EXECUTIVE_ICONS]
        const tone = EXECUTIVE_TONES[kpi.id as keyof typeof EXECUTIVE_TONES]

        return (
          <FilterableKpiCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            icon={Icon}
            tone={tone}
            hint={kpi.hint}
            href={kpi.href}
          />
        )
      })}
    </KpiCardGrid>
  )
}
