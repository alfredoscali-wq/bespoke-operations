"use client"

import { FileSpreadsheet, Users } from "lucide-react"

import { useSubscriptions } from "@/components/subscriptions/subscriptions-provider"
import { KpiCard } from "@/components/ui/kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"

export function SubscriptionsTvOverview() {
  const { summary, isSummaryReady, showPadronView } = useSubscriptions()

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Padrón ABNet</h2>
        <p className="text-xs text-muted-foreground">
          Filas de Conex. Internet + TV. Un N° Cliente con varias filas se
          muestra varias veces.
        </p>
      </div>
      <KpiCardGrid layout="standard">
        <button
          type="button"
          className="rounded-xl text-left"
          onClick={() => showPadronView("all")}
          aria-label="Ver todas las filas del padrón"
        >
          <KpiCard
            label="Total filas de TV"
            value={isSummaryReady ? (summary?.rows ?? 0) : "—"}
            icon={FileSpreadsheet}
            tone="green"
            compact
            hint="Filas del Excel, sin fusionar"
          />
        </button>
        <button
          type="button"
          className="rounded-xl text-left"
          onClick={() => showPadronView("all")}
          aria-label="Ver clientes únicos del padrón"
        >
          <KpiCard
            label="Clientes únicos"
            value={isSummaryReady ? (summary?.uniqueCustomers ?? 0) : "—"}
            icon={Users}
            tone="blue"
            compact
            hint="N° Cliente distintos"
          />
        </button>
      </KpiCardGrid>
    </section>
  )
}
