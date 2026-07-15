"use client"

import { EmployeeReportActivityList } from "@/components/reportes/empleado/employee-report-activity-list"
import { EmployeeReportExportActions } from "@/components/reportes/empleado/employee-report-export-actions"
import { EmployeeReportFilters } from "@/components/reportes/empleado/employee-report-filters"
import { EmployeeReportKpiSection } from "@/components/reportes/empleado/employee-report-kpi-section"
import { EmployeeReportProfileCard } from "@/components/reportes/empleado/employee-report-profile-card"
import {
  EmployeeReportsProvider,
  useEmployeeReports,
} from "@/components/reportes/empleado/employee-reports-provider"
import { ReportesSectionNav } from "@/components/reportes/reportes-section-nav"

function EmployeeReportsModuleContent() {
  const { error } = useEmployeeReports()

  return (
    <div className="space-y-6">
      <ReportesSectionNav />

      <div className="print:pt-0">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Reportes por Empleado
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Ficha de rendimiento individual adaptable al área del empleado. Los
          indicadores filtran el listado de actividad del período.
        </p>
      </div>

      <EmployeeReportFilters />
      <EmployeeReportExportActions />

      {error ? (
        <p className="text-sm text-destructive print:hidden">{error}</p>
      ) : null}

      <EmployeeReportProfileCard />
      <EmployeeReportKpiSection />
      <EmployeeReportActivityList />
    </div>
  )
}

export function EmployeeReportsModule() {
  return (
    <EmployeeReportsProvider>
      <EmployeeReportsModuleContent />
    </EmployeeReportsProvider>
  )
}
