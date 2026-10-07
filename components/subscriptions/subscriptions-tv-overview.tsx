"use client"

import { useSubscriptions } from "@/components/subscriptions/subscriptions-provider"

export function SubscriptionsTvOverview() {
  const { summary, isSummaryReady, showPadronView } = useSubscriptions()
  const rows = isSummaryReady
    ? (summary?.rows ?? 0).toLocaleString("es-AR")
    : "—"
  const uniqueCustomers = isSummaryReady
    ? (summary?.uniqueCustomers ?? 0).toLocaleString("es-AR")
    : "—"

  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-base font-semibold">Padrón ABNet</h2>
        <p className="text-sm text-muted-foreground">
          Filas de Conex. Internet + TV. Un N° Cliente con varias filas se
          muestra varias veces.
        </p>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
        <button
          type="button"
          className="cursor-pointer text-left"
          onClick={() => showPadronView("all")}
          aria-label="Ver todas las filas del padrón"
        >
          <span className="text-muted-foreground">Total filas de TV</span>{" "}
          <span className="font-semibold tabular-nums">{rows}</span>
        </button>
        <button
          type="button"
          className="cursor-pointer text-left"
          onClick={() => showPadronView("all")}
          aria-label="Ver clientes únicos del padrón"
        >
          <span className="text-muted-foreground">Clientes únicos</span>{" "}
          <span className="font-semibold tabular-nums">{uniqueCustomers}</span>
        </button>
      </div>
    </section>
  )
}
