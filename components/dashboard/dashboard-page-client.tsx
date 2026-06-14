"use client"

import { useMemo } from "react"
import Link from "next/link"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { KpiGrid } from "@/components/dashboard/kpi-card"
import { OperationsOverview } from "@/components/dashboard/operations-overview"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { UpcomingTasks } from "@/components/dashboard/upcoming-tasks"
import { useEvidence } from "@/components/evidencias/evidence-provider"
import { useProjects } from "@/components/obras/projects-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import {
  buildKpiMetrics,
  buildOperationsSegments,
  buildRecentActivity,
  buildUpcomingTasks,
} from "@/lib/data/dashboard"
import { Button } from "@/components/ui/button"

export function DashboardPageClient() {
  const { projects } = useProjects()
  const { tasks } = useTasks()
  const { evidence } = useEvidence()
  const { crews } = useCrews()

  const kpiMetrics = useMemo(
    () => buildKpiMetrics(projects, tasks, evidence, crews),
    [projects, tasks, evidence, crews]
  )

  const recentActivity = useMemo(
    () => buildRecentActivity(projects, tasks, evidence),
    [projects, tasks, evidence]
  )

  const upcomingTasks = useMemo(
    () => buildUpcomingTasks(tasks),
    [tasks]
  )

  const operationsSegments = useMemo(
    () => buildOperationsSegments(projects),
    [projects]
  )

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
            Monitoreo en tiempo real de obras, tareas, cuadrillas y evidencias
            registradas en Supabase.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/tareas">Ver tareas</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/obras">Nueva obra</Link>
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
