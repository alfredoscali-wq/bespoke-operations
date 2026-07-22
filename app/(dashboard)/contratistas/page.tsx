import { Suspense } from "react"

import { ContractorsModule } from "@/components/contratistas/contractors-module"
import { KpiGridSkeleton } from "@/components/ui/kpi-grid-skeleton"

export default function ContratistasPage() {
  return (
    <Suspense fallback={<KpiGridSkeleton count={3} layout="standard" />}>
      <ContractorsModule />
    </Suspense>
  )
}
