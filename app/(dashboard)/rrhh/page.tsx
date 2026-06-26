import { Suspense } from "react"

import { EmployeesModule } from "@/components/rrhh/employees-module"
import { KpiGridSkeleton } from "@/components/ui/kpi-grid-skeleton"

export default function RrhhPage() {
  return (
    <Suspense fallback={<KpiGridSkeleton count={8} layout="compact" compact />}>
      <EmployeesModule />
    </Suspense>
  )
}
