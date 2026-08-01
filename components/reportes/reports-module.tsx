"use client"

import { useMemo } from "react"
import Link from "next/link"

import { AnalysisBreadcrumb } from "@/components/analysis/analysis-breadcrumb"
import { useAnalysisNavContext } from "@/components/analysis/use-analysis-nav-context"
import { ExportReportActions } from "@/components/reportes/export-report-actions"
import { ReportesSectionNav } from "@/components/reportes/reportes-section-nav"
import { ReportsCrewProductivity } from "@/components/reportes/reports-crew-productivity"
import { ReportsCrewRanking } from "@/components/reportes/reports-crew-ranking"
import { ReportsFilters } from "@/components/reportes/reports-filters"
import { ReportsLocalities } from "@/components/reportes/reports-localities"
import { ReportsOldestPending } from "@/components/reportes/reports-oldest-pending"
import { ReportsProvider, useReports } from "@/components/reportes/reports-provider"
import { ReportsServiceTypes } from "@/components/reportes/reports-service-types"
import { ReportsSummaryCards } from "@/components/reportes/reports-summary-cards"
import { Button } from "@/components/ui/button"
import {
  buildAnalysisBreadcrumb,
  hrefCuadrillas,
} from "@/lib/analysis/smart-navigation"
import { buildManagementReport } from "@/lib/reports/management-report"
import { resolveReportPeriodRange } from "@/lib/reports/report-utils"

export function ReportsModule() {
  return (
    <ReportsProvider>
      <ReportsModuleContent />
    </ReportsProvider>
  )
}

function ReportsModuleContent() {
  const { filters, tasks, projects, crews } = useReports()
  const { context } = useAnalysisNavContext("reportes")

  const crumbs = useMemo(
    () =>
      buildAnalysisBreadcrumb({
        currentStep: "reportes",
        context,
      }),
    [context]
  )

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

  const timelineHref = useMemo(() => {
    if (!filters.crewId) return null
    const crew = crews.find((entry) => entry.id === filters.crewId)
    const range = resolveReportPeriodRange(filters)
    const date =
      filters.period === "custom" && filters.startDate
        ? filters.startDate
        : range.endDate
    return hrefCuadrillas(
      {
        ...context,
        date,
        crewId: filters.crewId,
        crewName: crew?.name,
      },
      "reportes"
    )
  }, [context, crews, filters])

  return (
    <div className="space-y-8">
      <ReportesSectionNav />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <AnalysisBreadcrumb crumbs={crumbs} className="mb-2" />
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Reportes Operativos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Indicadores y análisis de órdenes de trabajo según período y filtros.
          </p>
        </div>
        {timelineHref ? (
          <Button asChild variant="outline" size="sm">
            <Link href={timelineHref}>Abrir en Cuadrillas →</Link>
          </Button>
        ) : null}
      </div>

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
