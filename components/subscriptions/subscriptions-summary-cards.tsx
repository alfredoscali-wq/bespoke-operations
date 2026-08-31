"use client"

import { Tv } from "lucide-react"

import { useSubscriptions } from "@/components/subscriptions/subscriptions-provider"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"
import { formatTvMoney, tvKpiTone } from "@/lib/subscriptions/tv-plans"

export function SubscriptionsSummaryCards() {
  const { summary, selectedPlan, setSelectedPlan, isSummaryReady } =
    useSubscriptions()
  const plans = summary?.plans ?? []

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Planes</h2>
        <p className="text-xs text-muted-foreground">
          Hacé click en un plan para filtrar el listado. El ingreso es cantidad
          × precio actual del catálogo TV.
        </p>
      </div>
      <KpiCardGrid layout="standard">
        {plans.map((plan, index) => (
          <FilterableKpiCard
            key={plan.catalogId}
            label={plan.name}
            value={plan.activeCount}
            icon={Tv}
            tone={tvKpiTone(index)}
            compact
            isLoading={!isSummaryReady}
            isActive={selectedPlan === plan.catalogId}
            onClick={() => setSelectedPlan(plan.catalogId)}
            hint={`${formatTvMoney(plan.monthlyRevenue)} / mes`}
            ariaLabel={`Ver clientes con ${plan.name}`}
          />
        ))}
      </KpiCardGrid>
    </section>
  )
}
