import { Suspense } from "react"

import { CrewsModule } from "@/components/cuadrillas/crews-module"
import { KpiGridSkeleton } from "@/components/ui/kpi-grid-skeleton"

export default function CuadrillasPage() {
  return (
    <Suspense fallback={<KpiGridSkeleton count={4} layout="standard" />}>
      <CrewsModule />
    </Suspense>
  )
}
