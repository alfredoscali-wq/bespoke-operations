"use client"

import { useMemo, useState } from "react"
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  Wallet,
} from "lucide-react"

import { TreasuryPaymentMethodKpis } from "@/components/tesoreria/treasury-payment-method-kpis"
import { TreasuryPendingRenditionKpi } from "@/components/tesoreria/treasury-pending-rendition-kpi"
import { TreasuryPeriodToggle } from "@/components/tesoreria/treasury-period-toggle"
import { useTreasury } from "@/components/tesoreria/treasury-provider"
import {
  buildTreasuryDashboardSummary,
  formatTreasuryAmount,
} from "@/lib/tesoreria/summary"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"

type TreasurySummaryCardsProps = {
  pendingRenditionFilterActive: boolean
  onPendingRenditionToggle: () => void
}

export function TreasurySummaryCards({
  pendingRenditionFilterActive,
  onPendingRenditionToggle,
}: TreasurySummaryCardsProps) {
  const { movements, isReady, historyRange, setHistoryRange } = useTreasury()
  const [now] = useState(() => new Date())
  const summary = useMemo(
    () => buildTreasuryDashboardSummary(movements, now, historyRange),
    [movements, now, historyRange]
  )

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Período</p>
        <TreasuryPeriodToggle
          value={historyRange}
          onChange={setHistoryRange}
        />
      </div>

      <KpiCardGrid layout="treasury">
        <FilterableKpiCard
          label="Ingresos"
          value={formatTreasuryAmount(summary.income)}
          icon={ArrowUpCircle}
          tone="green"
          compact
          isLoading={!isReady}
          disabled
        />
        <FilterableKpiCard
          label="Egresos"
          value={formatTreasuryAmount(summary.expense)}
          icon={ArrowDownCircle}
          tone="red"
          compact
          isLoading={!isReady}
          disabled
        />
        <FilterableKpiCard
          label="Retiros del Período"
          value={formatTreasuryAmount(summary.withdrawalPeriod)}
          icon={Wallet}
          tone="orange"
          hint="Dinero retirado de caja."
          compact
          isLoading={!isReady}
          disabled
        />
        <TreasuryPendingRenditionKpi
          isActive={pendingRenditionFilterActive}
          onToggle={onPendingRenditionToggle}
        />
        <FilterableKpiCard
          label="Saldo del Período"
          value={formatTreasuryAmount(summary.currentBalance)}
          icon={Banknote}
          compact
          isLoading={!isReady}
          disabled
        />
      </KpiCardGrid>

      <TreasuryPaymentMethodKpis />
    </div>
  )
}
