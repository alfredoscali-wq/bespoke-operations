"use client"

import {
  Ban,
  CheckCircle2,
  CircleDot,
  TrendingUp,
} from "lucide-react"

import { useReports } from "@/components/reportes/reports-provider"
import { KpiCard } from "@/components/ui/kpi-card"
import { formatComplianceValue } from "@/lib/reports/report-utils"

export function ReportsSummaryCards() {
  const { summary } = useReports()

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Programadas"
        value={summary.programmed}
        icon={CircleDot}
        tone="green"
        hint="Órdenes con fecha programada en el período."
      />
      <KpiCard
        label="Completadas"
        value={summary.completed}
        icon={CheckCircle2}
        tone="yellow"
        hint="Órdenes finalizadas según fecha de completado."
      />
      <KpiCard
        label="Canceladas"
        value={summary.cancelled}
        icon={Ban}
        tone="red"
        hint="Órdenes canceladas con fecha programada en el período."
      />
      <KpiCard
        label="Cumplimiento"
        value={formatComplianceValue(summary.compliance)}
        icon={TrendingUp}
        tone="blue"
        hint="Completadas sobre programadas en el período."
      />
    </div>
  )
}
