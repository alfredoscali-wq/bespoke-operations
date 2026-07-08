import { Suspense } from "react"

import { AtencionClienteModule } from "@/components/atencion-cliente/atencion-cliente-module"
import { TableRowsSkeleton } from "@/components/ui/kpi-grid-skeleton"

function AtencionClientePageFallback() {
  return (
    <div className="space-y-6">
      <TableRowsSkeleton rows={8} columns={6} />
    </div>
  )
}

export default function AtencionClientePage() {
  return (
    <Suspense fallback={<AtencionClientePageFallback />}>
      <AtencionClienteModule />
    </Suspense>
  )
}
