"use client"

import { Tv, Users } from "lucide-react"

import { useSubscriptions } from "@/components/subscriptions/subscriptions-provider"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"

function formatCount(ready: boolean, value: number | undefined): number | string {
  if (!ready) return "—"
  return (value ?? 0).toLocaleString("es-AR")
}

export function SubscriptionsTvOverview() {
  const {
    summary,
    isSummaryReady,
    showPadronView,
    tvKind,
    jubiladoOnly,
    statusFilter,
  } = useSubscriptions()
  const totalPlansActive =
    tvKind === "all" && !jubiladoOnly && statusFilter === "all"

  return (
    <section>
      <KpiCardGrid layout="standard">
        <FilterableKpiCard
          label="TV Básica"
          value={formatCount(isSummaryReady, summary?.basicaCustomers)}
          hint="N° Cliente con este plan"
          icon={Tv}
          tone="blue"
          compact
          isLoading={!isSummaryReady}
          isActive={tvKind === "basica"}
          onClick={() => showPadronView("basica")}
          ariaLabel="Ver clientes con TV Básica"
        />
        <FilterableKpiCard
          label="TV Básica + Pack Fútbol"
          value={formatCount(isSummaryReady, summary?.basicaPackCustomers)}
          hint="N° Cliente con este plan"
          icon={Tv}
          tone="green"
          compact
          isLoading={!isSummaryReady}
          isActive={tvKind === "pack"}
          onClick={() => showPadronView("pack")}
          ariaLabel="Ver clientes con TV Básica y Pack Fútbol"
        />
        <FilterableKpiCard
          label="TV Full"
          value={formatCount(isSummaryReady, summary?.fullCustomers)}
          hint="N° Cliente con este plan"
          icon={Tv}
          tone="violet"
          compact
          isLoading={!isSummaryReady}
          isActive={tvKind === "full"}
          onClick={() => showPadronView("full")}
          ariaLabel="Ver clientes con TV Full"
        />
        <FilterableKpiCard
          label="Clientes con TV"
          value={formatCount(isSummaryReady, summary?.tvPlanCustomers)}
          hint="Suma de Básica, Pack y Full"
          icon={Users}
          tone="blue"
          compact
          isLoading={!isSummaryReady}
          isActive={totalPlansActive}
          onClick={() => showPadronView("all")}
          ariaLabel="Ver clientes cargados con planes de TV"
        />
      </KpiCardGrid>
    </section>
  )
}
