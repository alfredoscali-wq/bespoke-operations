"use client"

import { useMemo, useState } from "react"
import { Banknote } from "lucide-react"

import { useTreasury } from "@/components/tesoreria/treasury-provider"
import {
  buildOtRenditionKpi,
  formatOtRenditionKpiCount,
} from "@/lib/tesoreria/ot-renditions"
import { formatTreasuryAmount } from "@/lib/tesoreria/summary"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"

type TreasuryPendingRenditionKpiProps = {
  isActive: boolean
  onToggle: () => void
}

export function TreasuryPendingRenditionKpi({
  isActive,
  onToggle,
}: TreasuryPendingRenditionKpiProps) {
  const { otRenditions, isReady } = useTreasury()
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
      isActive={isActive}
      isLoading={!isReady}
      onClick={onToggle}
      ariaLabel={`Pendientes de Rendición: ${kpi.count} OT, ${formatTreasuryAmount(kpi.totalAmount)}`}
    />
  )
}
