"use client"

import { DollarSign, Users } from "lucide-react"

import { useSubscriptions } from "@/components/subscriptions/subscriptions-provider"
import { KpiCard } from "@/components/ui/kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"
import { formatTvMoney } from "@/lib/subscriptions/tv-plans"

export function SubscriptionsTvOverview() {
  const { summary, isSummaryReady, setSelectedPlan } = useSubscriptions()

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Resumen TV</h2>
        <p className="text-xs text-muted-foreground">
          Clientes e ingreso mensual del componente TV. No incluye Internet ni
          el abono comercial completo.
        </p>
      </div>
      <KpiCardGrid layout="standard">
        <button
          type="button"
          className="rounded-xl text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          onClick={() => setSelectedPlan("all")}
          aria-label="Ver todos los clientes con TV"
        >
          <KpiCard
            label="Clientes con TV"
            value={isSummaryReady ? (summary?.totalActiveCustomers ?? 0) : "—"}
            icon={Users}
            tone="green"
            compact
            hint="Servicios comerciales con componente TV activo"
          />
        </button>
        <KpiCard
          label="Ingreso mensual TV"
          value={
            isSummaryReady
              ? formatTvMoney(summary?.totalMonthlyRevenue ?? 0)
              : "—"
          }
          icon={DollarSign}
          tone="blue"
          compact
          hint="Cantidad × precio actual del catálogo TV"
        />
      </KpiCardGrid>
    </section>
  )
}
