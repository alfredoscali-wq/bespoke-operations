import Link from "next/link"
import {
  AlertTriangle,
  ClipboardList,
  Radio,
  TowerControl,
} from "lucide-react"

import type { DashboardExecutiveKpi } from "@/lib/data/dashboard"
import { KpiCard } from "@/components/ui/kpi-card"

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
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => {
        const Icon = EXECUTIVE_ICONS[kpi.id as keyof typeof EXECUTIVE_ICONS]
        const tone = EXECUTIVE_TONES[kpi.id as keyof typeof EXECUTIVE_TONES]

        return (
          <Link
            key={kpi.id}
            href={kpi.href}
            className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <KpiCard
              label={kpi.label}
              value={kpi.value}
              icon={Icon}
              tone={tone}
              hint={kpi.hint}
              className="h-full transition-shadow hover:shadow-md"
            />
          </Link>
        )
      })}
    </div>
  )
}
