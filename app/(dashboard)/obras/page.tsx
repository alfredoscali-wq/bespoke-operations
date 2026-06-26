import { Suspense } from "react"

import { ProjectsModule } from "@/components/obras/projects-module"
import { KpiGridSkeleton } from "@/components/ui/kpi-grid-skeleton"

export default function ObrasPage() {
  return (
    <Suspense fallback={<KpiGridSkeleton count={5} layout="operational" />}>
      <ProjectsModule />
    </Suspense>
  )
}
