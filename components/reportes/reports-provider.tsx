"use client"

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"

import {
  useAnalysisReportesCrewsQuery,
  useAnalysisReportesProjectsQuery,
  useAnalysisReportesTasksQuery,
} from "@/lib/analysis/react-query/use-analysis-reportes-queries"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  DEFAULT_REPORT_FILTERS,
  getReportLocalityOptions,
  type ReportFilters,
  type ReportPeriod,
} from "@/lib/reports/report-filters"
import {
  getCrewProductivity,
  getCrewRanking,
  type CrewProductivityRow,
} from "@/lib/reports/crew-productivity"
import { getLocalityReport, type LocalityReportRow } from "@/lib/reports/locality-reports"
import {
  getOperationalReportSummary,
  type OperationalReportSummary,
} from "@/lib/reports/operational-reports"
import {
  getOldestPendingTasks,
  type OldestPendingTaskRow,
} from "@/lib/reports/pending-reports"
import {
  getServiceTypeReport,
  type ServiceTypeReportRow,
} from "@/lib/reports/service-type-reports"
import type { Project } from "@/lib/types/projects"
import type { Task } from "@/lib/types/tasks"

type ReportesCrew = { id: string; name: string }

type ReportsContextValue = {
  filters: ReportFilters
  setFilters: Dispatch<SetStateAction<ReportFilters>>
  tasks: Task[]
  projects: Project[]
  crews: ReportesCrew[]
  isLoading: boolean
  summary: OperationalReportSummary
  crewProductivity: CrewProductivityRow[]
  crewRanking: CrewProductivityRow[]
  serviceTypeReport: ServiceTypeReportRow[]
  localityReport: LocalityReportRow[]
  oldestPendingTasks: OldestPendingTaskRow[]
  localityOptions: string[]
}

const ReportsContext = createContext<ReportsContextValue | null>(null)

function isValidDateInput(value: string | null | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function resolveInitialReportFilters(): ReportFilters {
  if (typeof window === "undefined") {
    return DEFAULT_REPORT_FILTERS
  }

  try {
    const params = new URLSearchParams(window.location.search)
    const date = params.get("date")?.trim()
    const dateFrom =
      params.get("dateFrom")?.trim() || params.get("startDate")?.trim()
    const dateTo =
      params.get("dateTo")?.trim() || params.get("endDate")?.trim()
    const crewId = params.get("crewId")?.trim()
    const periodRaw = params.get("period")?.trim() as ReportPeriod | undefined

    const next: ReportFilters = { ...DEFAULT_REPORT_FILTERS }

    if (crewId) {
      next.crewId = crewId
    }

    if (
      periodRaw === "today" ||
      periodRaw === "week" ||
      periodRaw === "month" ||
      periodRaw === "last30" ||
      periodRaw === "custom"
    ) {
      next.period = periodRaw
    }

    if (isValidDateInput(date)) {
      next.period = "custom"
      next.startDate = date
      next.endDate = date
    } else if (isValidDateInput(dateFrom) && isValidDateInput(dateTo)) {
      next.period = "custom"
      next.startDate = dateFrom
      next.endDate = dateTo
    }

    return next
  } catch {
    return DEFAULT_REPORT_FILTERS
  }
}

export function ReportsProvider({ children }: { children: ReactNode }) {
  const { companyId, isAuthReady } = useTenantCompanyId()
  const enabled = Boolean(isAuthReady && companyId)

  const tasksQuery = useAnalysisReportesTasksQuery(companyId, enabled)
  const projectsQuery = useAnalysisReportesProjectsQuery(companyId, enabled)
  const crewsQuery = useAnalysisReportesCrewsQuery(companyId, enabled)

  const tasks = tasksQuery.data ?? []
  const projects = projectsQuery.data ?? []
  const crews = crewsQuery.data ?? []
  const isLoading =
    tasksQuery.isPending || projectsQuery.isPending || crewsQuery.isPending

  const [filters, setFilters] = useState<ReportFilters>(
    resolveInitialReportFilters
  )

  const summary = useMemo(
    () => getOperationalReportSummary(tasks, filters, crews),
    [tasks, filters, crews]
  )

  const crewProductivity = useMemo(
    () => getCrewProductivity(tasks, filters, crews),
    [tasks, filters, crews]
  )

  const crewRanking = useMemo(
    () => getCrewRanking(tasks, filters, crews),
    [tasks, filters, crews]
  )

  const serviceTypeReport = useMemo(
    () => getServiceTypeReport(tasks, filters, crews),
    [tasks, filters, crews]
  )

  const localityReport = useMemo(
    () => getLocalityReport(tasks, filters, crews),
    [tasks, filters, crews]
  )

  const oldestPendingTasks = useMemo(
    () => getOldestPendingTasks(tasks, filters, crews),
    [tasks, filters, crews]
  )

  const localityOptions = useMemo(
    () => getReportLocalityOptions(tasks),
    [tasks]
  )

  const value = useMemo(
    () => ({
      filters,
      setFilters,
      tasks,
      projects,
      crews,
      isLoading,
      summary,
      crewProductivity,
      crewRanking,
      serviceTypeReport,
      localityReport,
      oldestPendingTasks,
      localityOptions,
    }),
    [
      filters,
      tasks,
      projects,
      crews,
      isLoading,
      summary,
      crewProductivity,
      crewRanking,
      serviceTypeReport,
      localityReport,
      oldestPendingTasks,
      localityOptions,
    ]
  )

  return (
    <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>
  )
}

export function useReports() {
  const context = useContext(ReportsContext)

  if (!context) {
    throw new Error("useReports must be used within ReportsProvider")
  }

  return context
}
