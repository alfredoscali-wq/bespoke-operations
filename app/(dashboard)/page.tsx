import Link from "next/link"
import { Button } from "@/components/ui/button"
import { KpiGrid } from "@/components/dashboard/kpi-card"
import { OperationsOverview } from "@/components/dashboard/operations-overview"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { UpcomingTasks } from "@/components/dashboard/upcoming-tasks"
import {
  buildKpiMetrics,
  buildOperationsSegments,
  buildRecentActivity,
  buildUpcomingTasks,
} from "@/lib/data/dashboard"

export default function DashboardPage() {
  const kpiMetrics = buildKpiMetrics()
  const recentActivity = buildRecentActivity()
  const upcomingTasks = buildUpcomingTasks()
  const operationsSegments = buildOperationsSegments()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">
            Resumen del día
          </p>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Operaciones en campo
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Monitoreo de despliegues de fibra, instalaciones de cámaras,
            proyectos wireless e infraestructura de postes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/tareas">Ver tareas</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/tareas">Nueva tarea</Link>
          </Button>
        </div>
      </div>

      <KpiGrid metrics={kpiMetrics} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentActivity items={recentActivity} />
        </div>
        <div className="space-y-6">
          <OperationsOverview segments={operationsSegments} />
        </div>
      </div>

      <UpcomingTasks tasks={upcomingTasks} />
    </div>
  )
}
