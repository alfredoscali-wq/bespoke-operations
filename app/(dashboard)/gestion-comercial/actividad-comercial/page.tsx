import { Suspense } from "react"

import { CommercialTerritorialActivityModule } from "@/components/gestion-comercial/actividad-comercial/commercial-territorial-activity-module"
import { TableRowsSkeleton } from "@/components/ui/kpi-grid-skeleton"

export default function GestionComercialActividadComercialPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Actividad Comercial
            </h1>
            <p className="text-sm text-muted-foreground">
              Cargando mapa de actividad…
            </p>
          </div>
          <TableRowsSkeleton columns={4} rows={4} />
        </div>
      }
    >
      <CommercialTerritorialActivityModule />
    </Suspense>
  )
}
