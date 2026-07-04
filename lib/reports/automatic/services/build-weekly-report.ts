import { ABSENCE_TYPES } from "@/lib/reports/automatic/services/absence-types"
import {
  buildWeeklyCrewPerformance,
  buildWeeklyExecutiveSummary,
  buildWeeklyProductionCounts,
  buildWeeklyReportAlerts,
  collectAbsentOperarioIdsForWeek,
} from "@/lib/reports/automatic/services/weekly-metrics"
import { generateWeeklyReportNarrative } from "@/lib/reports/automatic/services/generate-summary-text"
import {
  formatInformedWeekLabel,
  resolveInformedWeekRange,
  resolveIsoWeekNumber,
} from "@/lib/reports/automatic/scheduler/week-range"
import {
  WEEKLY_REPORT_ID,
  WEEKLY_REPORT_SUBTITLE,
  WEEKLY_REPORT_TITLE,
} from "@/lib/reports/automatic/config"
import type { WeeklyAutomaticReport } from "@/lib/reports/automatic/types"
import { isDateWithinRange } from "@/lib/availability/utils"
import { createAdminClient } from "@/lib/supabase/admin"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import { fetchCrews } from "@/lib/supabase/crews.queries"
import { fetchEmployeeAvailabilities } from "@/lib/supabase/employee-availability.queries"
import { fetchProjects } from "@/lib/supabase/projects.queries"
import { fetchTasks } from "@/lib/supabase/tasks.queries"
import type { EmployeeAvailability } from "@/lib/types/availability"

export type WeeklyReportSourceData = {
  activeCustomers: number
  inactiveCustomers: number
  tasks: Awaited<ReturnType<typeof fetchTasks>>["data"]
  crews: Awaited<ReturnType<typeof fetchCrews>>["data"]
  projects: Awaited<ReturnType<typeof fetchProjects>>["data"]
  availabilities: EmployeeAvailability[]
}

async function countCustomersByStatus(
  companyId: string
): Promise<{
  activeCustomers: number
  inactiveCustomers: number
}> {
  const client = createAdminClient()

  const base = () =>
    client
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .is("deleted_at", null)

  const [activeResult, inactiveResult] = await Promise.all([
    base().eq("status", "activo"),
    base().eq("status", "inactivo"),
  ])

  const error = activeResult.error ?? inactiveResult.error
  if (error) {
    throw new Error(error.message)
  }

  return {
    activeCustomers: activeResult.count ?? 0,
    inactiveCustomers: inactiveResult.count ?? 0,
  }
}

function buildAbsentOperarioLookup(
  availabilities: EmployeeAvailability[]
): (date: string) => Set<string> {
  return (date: string) => {
    const absent = new Set<string>()

    for (const record of availabilities) {
      if (!ABSENCE_TYPES.includes(record.availabilityType)) {
        continue
      }

      if (!isDateWithinRange(date, record.startDate, record.endDate)) {
        continue
      }

      absent.add(record.employeeId)
    }

    return absent
  }
}

export async function fetchWeeklyReportSourceData(
  companyId: string = BESPOKE_PRODUCTION_COMPANY_ID
): Promise<WeeklyReportSourceData> {
  const client = createAdminClient()

  const [
    customerCounts,
    tasksResult,
    crewsResult,
    projectsResult,
    availabilitiesResult,
  ] = await Promise.all([
    countCustomersByStatus(companyId),
    fetchTasks(client, companyId),
    fetchCrews(client, companyId),
    fetchProjects(client, companyId),
    fetchEmployeeAvailabilities(client, companyId),
  ])

  const errors = [
    tasksResult.error,
    crewsResult.error,
    projectsResult.error,
    availabilitiesResult.error,
  ].filter(Boolean)

  if (errors.length > 0) {
    throw new Error(errors[0]?.message ?? "Error al cargar datos del reporte.")
  }

  return {
    activeCustomers: customerCounts.activeCustomers,
    inactiveCustomers: customerCounts.inactiveCustomers,
    tasks: tasksResult.data ?? [],
    crews: crewsResult.data ?? [],
    projects: projectsResult.data ?? [],
    availabilities: availabilitiesResult.data ?? [],
  }
}

export function buildWeeklyAutomaticReport(
  source: WeeklyReportSourceData,
  referenceDate = new Date(),
  companyName = "Bespoke Operations"
): WeeklyAutomaticReport {
  const informedWeek = resolveInformedWeekRange(referenceDate)
  const tasks = source.tasks ?? []
  const crews = source.crews ?? []
  const projects = source.projects ?? []

  const absentOperarioIds = collectAbsentOperarioIdsForWeek({
    crews,
    range: informedWeek,
    isAbsentOnDate: buildAbsentOperarioLookup(source.availabilities),
  })

  const summary = buildWeeklyExecutiveSummary({
    activeCustomers: source.activeCustomers,
    inactiveCustomers: source.inactiveCustomers,
    activeProjects: projects.filter((project) => project.status === "active")
      .length,
    tasks,
    range: informedWeek,
  })

  const crewPerformance = buildWeeklyCrewPerformance({
    tasks,
    crews,
    range: informedWeek,
  })

  const production = buildWeeklyProductionCounts(tasks, informedWeek)

  const alerts = buildWeeklyReportAlerts({
    tasks,
    projects,
    absentOperarioIds,
  })

  const partialReport = {
    summary,
    crewPerformance,
    production,
    alerts,
  }

  return {
    reportId: WEEKLY_REPORT_ID,
    title: WEEKLY_REPORT_TITLE,
    subtitle: WEEKLY_REPORT_SUBTITLE,
    companyName,
    informedWeek,
    informedWeekLabel: formatInformedWeekLabel(informedWeek),
    weekNumber: resolveIsoWeekNumber(informedWeek),
    generatedAt: referenceDate.toISOString(),
    summary,
    crewPerformance,
    production,
    alerts,
    narrativeSummary: generateWeeklyReportNarrative(partialReport),
  }
}

export async function loadWeeklyAutomaticReport(
  referenceDate = new Date(),
  companyName?: string
): Promise<WeeklyAutomaticReport> {
  const source = await fetchWeeklyReportSourceData()
  const resolvedCompanyName =
    companyName?.trim() || "Bespoke Operations"
  return buildWeeklyAutomaticReport(source, referenceDate, resolvedCompanyName)
}
