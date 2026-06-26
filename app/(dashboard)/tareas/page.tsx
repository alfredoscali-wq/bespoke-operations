import { Suspense } from "react"

import { TasksModule } from "@/components/tareas/tasks-module"
import { KpiGridSkeleton } from "@/components/ui/kpi-grid-skeleton"

export default function TareasPage() {
  return (
    <Suspense fallback={<KpiGridSkeleton count={6} layout="operational" />}>
      <TasksModule />
    </Suspense>
  )
}
