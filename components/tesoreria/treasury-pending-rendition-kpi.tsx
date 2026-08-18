"use client"

import { useMemo } from "react"
import { Banknote } from "lucide-react"

import { useTreasury } from "@/components/tesoreria/treasury-provider"
import {
  buildOtRenditionKpi,
  formatOtRenditionKpiCount,
} from "@/lib/tesoreria/ot-renditions"
import { formatTreasuryAmount } from "@/lib/tesoreria/summary"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"

export function TreasuryPendingRenditionKpi() {
  const { otRenditions, isReady, historyFilter, toggleHistoryFilter } =
    useTreasury()
  const kpi = useMemo(
    () => buildOtRenditionKpi(otRenditions),
    [otRenditions]
  )

  return (
    <FilterableKpiCard
      label="Pendientes de Rendición"
      value={formatOtRenditionKpiCount(kpi.count)}
      hint={formatTreasuryAmount(kpi.totalAmount)}
      icon={Banknote}
      tone="amber"
      compact
      isActive={historyFilter.type === "pendingRendition"}
      isLoading={!isReady}
      onClick={() => toggleHistoryFilter({ type: "pendingRendition" })}
      ariaLabel={`Pendientes de Rendición: ${kpi.count} OT, ${formatTreasuryAmount(kpi.totalAmount)}`}
    />
  )
}
