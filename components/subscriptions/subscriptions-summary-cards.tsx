"use client"

import { Tv } from "lucide-react"

import { useSubscriptions } from "@/components/subscriptions/subscriptions-provider"
import { FilterableKpiCard } from "@/components/ui/filterable-kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"
import {
  ABNET_TV_PADRON_STATUSES,
  formatAbnetPadronMoney,
} from "@/lib/subscriptions/abnet-tv-padron"

export function SubscriptionsSummaryCards() {
  const { summary, tvKind, jubiladoOnly, statusFilter, showPadronView, isSummaryReady } =
    useSubscriptions()

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">TV del padrón</h2>
        <p className="text-xs text-muted-foreground">
          TV Básica es la columna TV = 4.500. TV Full es TV = 9.900. Los
          importes suman esa columna, no el abono de Internet.
        </p>
      </div>
      <KpiCardGrid layout="standard">
        <FilterableKpiCard
          label="TV Básica"
          value={summary?.basicaRows ?? 0}
          hint={formatAbnetPadronMoney(summary?.basicaAmount ?? 0)}
          icon={Tv}
          tone="blue"
          compact
          isLoading={!isSummaryReady}
          isActive={tvKind === "basica"}
          onClick={() => showPadronView("basica")}
          ariaLabel="Ver filas con TV Básica"
        />
        <FilterableKpiCard
          label="TV Full"
          value={summary?.fullRows ?? 0}
          hint={formatAbnetPadronMoney(summary?.fullAmount ?? 0)}
          icon={Tv}
          tone="violet"
          compact
          isLoading={!isSummaryReady}
          isActive={tvKind === "full"}
          onClick={() => showPadronView("full")}
          ariaLabel="Ver filas con TV Full"
        />
        <FilterableKpiCard
          label="TV Básica + Pack Fútbol"
          value={summary?.basicaPackRows ?? 0}
          hint={formatAbnetPadronMoney(summary?.basicaPackAmount ?? 0)}
          icon={Tv}
          tone="green"
          compact
          isLoading={!isSummaryReady}
          isActive={tvKind === "pack"}
          onClick={() => showPadronView("pack")}
          ariaLabel="Ver filas con TV Básica y Pack Fútbol"
        />
        <FilterableKpiCard
          label="Jubilados"
          value={summary?.jubiladoRows ?? 0}
          hint={`${summary?.jubiladoRowsAt2250 ?? 0} × $2.250 · ${summary?.jubiladoRowsAt4500 ?? 0} × $4.500 · ${formatAbnetPadronMoney(summary?.jubiladoAmount ?? 0)}`}
          icon={Tv}
          tone="amber"
          compact
          isLoading={!isSummaryReady}
          isActive={jubiladoOnly}
          onClick={() => showPadronView("jubilado")}
          ariaLabel="Ver filas jubiladas"
        />
      </KpiCardGrid>
      <KpiCardGrid layout="standard">
        {ABNET_TV_PADRON_STATUSES.map((status) => (
          <FilterableKpiCard
            key={status}
            label={status}
            value={summary?.statusRows[status] ?? 0}
            icon={Tv}
            tone="orange"
            compact
            isLoading={!isSummaryReady}
            isActive={statusFilter === status}
            onClick={() => showPadronView(status)}
            ariaLabel={`Ver filas ${status}`}
          />
        ))}
      </KpiCardGrid>
    </section>
  )
}
