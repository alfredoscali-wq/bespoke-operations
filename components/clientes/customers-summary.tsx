"use client"

import { AlertTriangle, CheckCircle2, Clock3, Users } from "lucide-react"

import { useCustomers } from "@/components/clientes/customers-provider"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"
import {
  CUSTOMER_KPI_LABELS,
  CUSTOMER_KPI_ORDER,
  CUSTOMER_KPI_TONE,
  getOperationalKpiValue,
  type CustomerQuickFilter,
} from "@/lib/customers/customer-operational"

const KPI_ICONS = {
  operativos: Users,
  activos: CheckCircle2,
  "pendientes-activacion": Clock3,
  revisar: AlertTriangle,
} as const

type CustomersSummaryProps = {
  quickFilter: CustomerQuickFilter
  onQuickFilterChange: (filter: CustomerQuickFilter) => void
}

export function CustomersSummary({
  quickFilter,
  onQuickFilterChange,
}: CustomersSummaryProps) {
  const { operationalSummary, isSummaryLoading } = useCustomers()

  return (
    <KpiCardGrid layout="standard">
      {CUSTOMER_KPI_ORDER.map((kpi) => {
        const Icon = KPI_ICONS[kpi]

        return (
          <FilterableKpiCard
            key={kpi}
            label={CUSTOMER_KPI_LABELS[kpi]}
            value={
              isSummaryLoading
                ? "…"
                : getOperationalKpiValue(operationalSummary, kpi)
            }
            icon={Icon}
            tone={CUSTOMER_KPI_TONE[kpi]}
            isActive={quickFilter === kpi}
            isLoading={isSummaryLoading}
            onClick={() => onQuickFilterChange(kpi)}
          />
        )
      })}
    </KpiCardGrid>
  )
}
