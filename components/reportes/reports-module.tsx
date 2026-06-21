"use client"

import { useMemo } from "react"

import { ExportReportActions } from "@/components/reportes/export-report-actions"
import { ReportsCrewProductivity } from "@/components/reportes/reports-crew-productivity"
import { ReportsCrewRanking } from "@/components/reportes/reports-crew-ranking"
import { ReportsFilters } from "@/components/reportes/reports-filters"
import { ReportsLocalities } from "@/components/reportes/reports-localities"
import { ReportsOldestPending } from "@/components/reportes/reports-oldest-pending"
import { ReportsProvider, useReports } from "@/components/reportes/reports-provider"
import { ReportsServiceTypes } from "@/components/reportes/reports-service-types"
import { ReportsSummaryCards } from "@/components/reportes/reports-summary-cards"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useProjects } from "@/components/obras/projects-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { buildManagementReport } from "@/lib/reports/management-report"

export function ReportsModule() {
  return (
    <ReportsProvider>
      <ReportsModuleContent />
    </ReportsProvider>
  )
}

function ReportsModuleContent() {
  const { filters } = useReports()
  const { tasks } = useTasks()
  const { projects } = useProjects()
  const { crews } = useCrews()

  const managementReport = useMemo(
    () =>
      buildManagementReport({
        tasks,
        projects,
        filters,
        crews,
      }),
    [tasks, projects, filters, crews]
  )

  return (
    <div className="space-y-8">
      <ReportsFilters />
      <ExportReportActions report={managementReport} />
      <ReportsSummaryCards />
      <ReportsCrewProductivity />
      <ReportsCrewRanking />
      <ReportsServiceTypes />
      <ReportsLocalities />
      <ReportsOldestPending />
    </div>
  )
}
