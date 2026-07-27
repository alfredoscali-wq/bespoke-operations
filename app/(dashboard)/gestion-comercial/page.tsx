import { Suspense } from "react"

import { CommercialModule } from "@/components/gestion-comercial/commercial-module"
import { TableRowsSkeleton } from "@/components/ui/kpi-grid-skeleton"

export default function GestionComercialPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Gestión Comercial
            </h1>
            <p className="text-sm text-muted-foreground">
              Administra prospectos y oportunidades comerciales.
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <TableRowsSkeleton columns={5} rows={4} />
          </div>
        </div>
      }
    >
      <CommercialModule />
    </Suspense>
  )
}
