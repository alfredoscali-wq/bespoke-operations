"use client"

import { useMemo, useState } from "react"
import { ArrowDownCircle, ArrowUpCircle, Banknote, Clock3 } from "lucide-react"

import { useTreasury } from "@/components/tesoreria/treasury-provider"
import {
  buildTreasuryDashboardSummary,
  formatTreasuryAmount,
} from "@/lib/tesoreria/summary"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"

export function TreasurySummaryCards() {
  const { movements, isReady } = useTreasury()
  const [now] = useState(() => new Date())
  const summary = useMemo(
    () => buildTreasuryDashboardSummary(movements, now),
    [movements, now]
  )

  return (
    <KpiCardGrid layout="standard">
      <FilterableKpiCard
        label="Saldo Actual"
        value={formatTreasuryAmount(summary.currentBalance)}
        icon={Banknote}
        isLoading={!isReady}
        disabled
      />
      <FilterableKpiCard
        label="Ingresos del Día"
        value={formatTreasuryAmount(summary.incomeToday)}
        icon={ArrowUpCircle}
        tone="green"
        isLoading={!isReady}
        disabled
      />
      <FilterableKpiCard
        label="Egresos del Día"
        value={formatTreasuryAmount(summary.expenseToday)}
        icon={ArrowDownCircle}
        tone="red"
        isLoading={!isReady}
        disabled
      />
      <FilterableKpiCard
        label="Pendiente de Rendición"
        value={formatTreasuryAmount(summary.pendingRendition)}
        icon={Clock3}
        tone="amber"
        isLoading={!isReady}
        disabled
      />
    </KpiCardGrid>
  )
}
