import { Suspense } from "react"

import { CommercialTerritoryModule } from "@/components/gestion-comercial/territory/commercial-territory-module"
import { TableRowsSkeleton } from "@/components/ui/kpi-grid-skeleton"

export default function GestionComercialMapaPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Territorio Comercial
            </h1>
            <p className="text-sm text-muted-foreground">
              Cargando mapa comercial…
            </p>
          </div>
          <TableRowsSkeleton columns={4} rows={4} />
        </div>
      }
    >
      <CommercialTerritoryModule />
    </Suspense>
  )
}
