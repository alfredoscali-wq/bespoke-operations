"use client"

import { AlertTriangle, CheckCircle2, Users } from "lucide-react"

import { useCustomers } from "@/components/clientes/customers-provider"
import { KpiCard } from "@/components/ui/kpi-card"
import {
  CUSTOMER_KPI_LABELS,
  CUSTOMER_KPI_ORDER,
  CUSTOMER_KPI_TONE,
  getOperationalKpiValue,
  type CustomerQuickFilter,
} from "@/lib/customers/customer-operational"
import { cn } from "@/lib/utils"

const KPI_ICONS = {
  operativos: Users,
  activos: CheckCircle2,
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
    <div className="grid gap-5 sm:grid-cols-3">
      {CUSTOMER_KPI_ORDER.map((kpi) => {
        const isActive = quickFilter === kpi
        const Icon = KPI_ICONS[kpi]

        return (
          <button
            key={kpi}
            type="button"
            onClick={() => onQuickFilterChange(kpi)}
            className={cn(
              "rounded-xl text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              isActive && "ring-2 ring-primary/25"
            )}
          >
            <KpiCard
              label={CUSTOMER_KPI_LABELS[kpi]}
              value={
                isSummaryLoading
                  ? "…"
                  : getOperationalKpiValue(operationalSummary, kpi)
              }
              icon={Icon}
              tone={CUSTOMER_KPI_TONE[kpi]}
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
