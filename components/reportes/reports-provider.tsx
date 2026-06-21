"use client"

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import {
  DEFAULT_REPORT_FILTERS,
  getReportLocalityOptions,
  type ReportFilters,
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

type ReportsContextValue = {
  filters: ReportFilters
  setFilters: Dispatch<SetStateAction<ReportFilters>>
  summary: OperationalReportSummary
  crewProductivity: CrewProductivityRow[]
  crewRanking: CrewProductivityRow[]
  serviceTypeReport: ServiceTypeReportRow[]
  localityReport: LocalityReportRow[]
  oldestPendingTasks: OldestPendingTaskRow[]
  localityOptions: string[]
}

const ReportsContext = createContext<ReportsContextValue | null>(null)

export function ReportsProvider({ children }: { children: React.ReactNode }) {
  const { tasks } = useTasks()
  const { crews } = useCrews()
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_REPORT_FILTERS)

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
