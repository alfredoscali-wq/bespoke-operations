import { Suspense } from "react"

import { TreasuryModule } from "@/components/tesoreria/treasury-module"
import { KpiGridSkeleton } from "@/components/ui/kpi-grid-skeleton"

export default function TesoreriaPage() {
  return (
    <Suspense fallback={<KpiGridSkeleton count={4} layout="standard" />}>
      <TreasuryModule />
    </Suspense>
  )
}
