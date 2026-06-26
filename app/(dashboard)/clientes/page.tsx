import { Suspense } from "react"

import { CustomersModule } from "@/components/clientes/customers-module"
import { KpiGridSkeleton } from "@/components/ui/kpi-grid-skeleton"
import { TableRowsSkeleton } from "@/components/ui/kpi-grid-skeleton"

function CustomersPageFallback() {
  return (
    <div className="space-y-6">
      <KpiGridSkeleton count={3} layout="triple" />
      <TableRowsSkeleton rows={8} columns={5} />
    </div>
  )
}

export default function ClientesPage() {
  return (
    <Suspense fallback={<CustomersPageFallback />}>
      <CustomersModule />
    </Suspense>
  )
}
