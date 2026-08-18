"use client"

import { useMemo, useState } from "react"
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CircleDollarSign,
  Wallet,
} from "lucide-react"

import { TreasuryPaymentMethodKpis } from "@/components/tesoreria/treasury-payment-method-kpis"
import { TreasuryPendingRenditionKpi } from "@/components/tesoreria/treasury-pending-rendition-kpi"
import { TreasuryPeriodToggle } from "@/components/tesoreria/treasury-period-toggle"
import { useTreasury } from "@/components/tesoreria/treasury-provider"
import { buildTreasuryCashInBoxMonth } from "@/lib/tesoreria/ot-rendition-payment-kpis"
import {
  buildTreasuryDashboardSummary,
  formatTreasuryAmount,
} from "@/lib/tesoreria/summary"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"

export function TreasurySummaryCards() {
  const {
    movements,
    isReady,
    historyRange,
    setHistoryRange,
    historyFilter,
    toggleHistoryFilter,
  } = useTreasury()
  const [now] = useState(() => new Date())
  const summary = useMemo(
    () => buildTreasuryDashboardSummary(movements, now, historyRange),
    [movements, now, historyRange]
  )
  const cashInBox = useMemo(
    () => buildTreasuryCashInBoxMonth(movements, now),
    [movements, now]
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

      <KpiCardGrid layout="treasurySix">
        <FilterableKpiCard
          label="Ingresos"
          value={formatTreasuryAmount(summary.income)}
          icon={ArrowUpCircle}
          tone="green"
          compact
          isLoading={!isReady}
          isActive={historyFilter.type === "income"}
          onClick={() => toggleHistoryFilter({ type: "income" })}
        />
        <FilterableKpiCard
          label="Egresos"
          value={formatTreasuryAmount(summary.expense)}
          icon={ArrowDownCircle}
          tone="red"
          compact
          isLoading={!isReady}
          isActive={historyFilter.type === "expense"}
          onClick={() => toggleHistoryFilter({ type: "expense" })}
        />
        <FilterableKpiCard
          label="Retiros del Período"
          value={formatTreasuryAmount(summary.withdrawalPeriod)}
          icon={Wallet}
          tone="orange"
          hint="Dinero retirado de caja."
          compact
          isLoading={!isReady}
          isActive={historyFilter.type === "withdrawal"}
          onClick={() => toggleHistoryFilter({ type: "withdrawal" })}
        />
        <TreasuryPendingRenditionKpi />
        <FilterableKpiCard
          label="Saldo del Período"
          value={formatTreasuryAmount(summary.currentBalance)}
          icon={CircleDollarSign}
          compact
          isLoading={!isReady}
          isActive={historyFilter.type === "periodBalance"}
          onClick={() => toggleHistoryFilter({ type: "periodBalance" })}
        />
        <FilterableKpiCard
          label="Dinero en Caja"
          value={formatTreasuryAmount(cashInBox)}
          hint="Efectivo acumulado del mes"
          icon={Banknote}
          tone="blue"
          compact
          isLoading={!isReady}
          isActive={historyFilter.type === "cashInBox"}
          onClick={() => toggleHistoryFilter({ type: "cashInBox" })}
        />
      </KpiCardGrid>

      <TreasuryPaymentMethodKpis />
    </div>
  )
}
