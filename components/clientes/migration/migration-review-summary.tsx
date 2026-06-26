"use client"

import { AlertTriangle, CheckCircle2, Users } from "lucide-react"

import { useMigrationReview } from "@/components/clientes/migration/migration-review-provider"
import { KpiCard } from "@/components/ui/kpi-card"
import { MIGRATION_REVIEW_KPI_LABELS } from "@/lib/customers/commercial-migration/review-utils"
import type { MigrationReviewKpiFilter } from "@/lib/customers/commercial-migration/review-types"
import { cn } from "@/lib/utils"

const KPI_ICONS = {
  operativos: Users,
  activos: CheckCircle2,
  revisar: AlertTriangle,
} as const

const KPI_TONES = {
  operativos: "blue",
  activos: "green",
  revisar: "yellow",
} as const

type MigrationReviewSummaryProps = {
  kpiFilter: MigrationReviewKpiFilter
  onKpiFilterChange: (filter: MigrationReviewKpiFilter) => void
}

export function MigrationReviewSummary({
  kpiFilter,
  onKpiFilterChange,
}: MigrationReviewSummaryProps) {
  const { kpis } = useMigrationReview()

  const items: MigrationReviewKpiFilter[] = ["operativos", "activos", "revisar"]

  return (
    <div className="grid gap-5 sm:grid-cols-3">
      {items.map((item) => {
        const isActive = kpiFilter === item
        const Icon = KPI_ICONS[item]

        return (
          <button
            key={item}
            type="button"
            onClick={() => onKpiFilterChange(item)}
            className={cn(
              "rounded-xl text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
              isActive && "ring-2 ring-primary/25"
            )}
          >
            <KpiCard
              label={MIGRATION_REVIEW_KPI_LABELS[item]}
              value={kpis[item]}
              icon={Icon}
              tone={KPI_TONES[item]}
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
