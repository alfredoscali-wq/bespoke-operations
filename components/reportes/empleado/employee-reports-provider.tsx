"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useEmployees } from "@/components/rrhh/employees-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  buildEmployeeIndividualReport,
  employeeMatchesAreaFilter,
  filterEmployeeActivityByKpi,
  resolveEmployeeReportPeriodBounds,
  toEquipoReportPeriod,
  type EmployeeActivityRow,
  type EmployeeIndividualReport,
  type EmployeeReportArea,
  type EmployeeReportPeriod,
} from "@/lib/reports/employee-individual"
import { getEmployeeDisplayName } from "@/lib/employees/utils"
import {
  loadEmployeeAtencionMetrics,
  loadEmployeeReportAvailabilities,
} from "@/lib/supabase/employee-individual-report.browser"
import type { EmployeeAvailability } from "@/lib/types/availability"
import type { EquipoIndividualReport } from "@/lib/atencion-cliente-equipo/report"
import { resolveEmployeeReportArea } from "@/lib/reports/employee-individual/areas"

type EmployeeReportsContextValue = {
  employeeId: string
  setEmployeeId: Dispatch<SetStateAction<string>>
  areaFilter: EmployeeReportArea | "all"
  setAreaFilter: Dispatch<SetStateAction<EmployeeReportArea | "all">>
  supervisorFilter: string
  setSupervisorFilter: Dispatch<SetStateAction<string>>
  period: EmployeeReportPeriod
  setPeriod: Dispatch<SetStateAction<EmployeeReportPeriod>>
  customStartDate: string
  setCustomStartDate: Dispatch<SetStateAction<string>>
  customEndDate: string
  setCustomEndDate: Dispatch<SetStateAction<string>>
  activeKpiKey: string | null
  setActiveKpiKey: Dispatch<SetStateAction<string | null>>
  employeeOptions: Array<{ id: string; label: string; area: EmployeeReportArea }>
  supervisorOptions: string[]
  report: EmployeeIndividualReport | null
  filteredActivity: EmployeeActivityRow[]
  isLoading: boolean
  error: string | null
}

const EmployeeReportsContext =
  createContext<EmployeeReportsContextValue | null>(null)

export function EmployeeReportsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { companyId, isAuthReady } = useTenantCompanyId()
  const { employees, isEmployeesReady } = useEmployees()
  const { tasks, isTasksReady } = useTasks()
  const { crews, isCrewsReady } = useCrews()

  const [employeeId, setEmployeeId] = useState("")
  const [areaFilter, setAreaFilter] = useState<EmployeeReportArea | "all">(
    "all"
  )
  const [supervisorFilter, setSupervisorFilter] = useState("all")
  const [period, setPeriod] = useState<EmployeeReportPeriod>("mes")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const [activeKpiKey, setActiveKpiKey] = useState<string | null>(null)
  const [availability, setAvailability] = useState<EmployeeAvailability[]>([])
  const [atencionReport, setAtencionReport] =
    useState<EquipoIndividualReport | null>(null)
  const [atencionError, setAtencionError] = useState<string | null>(null)
  const [atencionLoading, setAtencionLoading] = useState(false)

  const bounds = useMemo(
    () =>
      resolveEmployeeReportPeriodBounds({
        period,
        customStartDate,
        customEndDate,
      }),
    [period, customStartDate, customEndDate]
  )

  const employeeOptions = useMemo(() => {
    return employees
      .filter((employee) => employeeMatchesAreaFilter(employee, areaFilter))
      .map((employee) => {
        const area = resolveEmployeeReportArea(employee)
        return {
          id: employee.id,
          label: getEmployeeDisplayName(employee),
          area,
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label, "es"))
  }, [employees, areaFilter])

  const supervisorOptions = useMemo(() => {
    const names = new Set<string>()
    for (const crew of crews) {
      if (crew.supervisor.trim()) {
        names.add(crew.supervisor.trim())
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b, "es"))
  }, [crews])

  useEffect(() => {
    if (!employeeOptions.some((option) => option.id === employeeId)) {
      setEmployeeId(employeeOptions[0]?.id ?? "")
    }
  }, [employeeOptions, employeeId])

  useEffect(() => {
    if (!isAuthReady || !companyId) {
      return
    }

    let cancelled = false

    async function loadAvailability() {
      const rows = await loadEmployeeReportAvailabilities(companyId)
      if (!cancelled) {
        setAvailability(rows)
      }
    }

    void loadAvailability()

    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady])

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === employeeId) ?? null,
    [employees, employeeId]
  )

  const selectedArea = selectedEmployee
    ? resolveEmployeeReportArea(selectedEmployee)
    : null

  useEffect(() => {
    if (
      !isAuthReady ||
      !companyId ||
      !selectedEmployee ||
      selectedArea !== "atencion"
    ) {
      setAtencionReport(null)
      setAtencionError(null)
      setAtencionLoading(false)
      return
    }

    let cancelled = false

    async function loadAtencion() {
      setAtencionLoading(true)
      setAtencionError(null)

      const result = await loadEmployeeAtencionMetrics({
        companyId,
        employeeId: selectedEmployee!.id,
        period: toEquipoReportPeriod(period),
      })

      if (cancelled) {
        return
      }

      if (result.error || !result.data) {
        setAtencionReport(null)
        setAtencionError(
          result.error?.message ?? "No se pudo cargar métricas de Atención."
        )
      } else {
        setAtencionReport(result.data)
      }

      setAtencionLoading(false)
    }

    void loadAtencion()

    return () => {
      cancelled = true
    }
  }, [
    companyId,
    isAuthReady,
    selectedEmployee,
    selectedArea,
    period,
  ])

  const report = useMemo(() => {
    if (!selectedEmployee) {
      return null
    }

    return buildEmployeeIndividualReport({
      employee: selectedEmployee,
      employees,
      tasks,
      crews,
      period,
      bounds,
      availability,
      atencionReport: selectedArea === "atencion" ? atencionReport : null,
    })
  }, [
    selectedEmployee,
    employees,
    tasks,
    crews,
    period,
    bounds,
    availability,
    atencionReport,
    selectedArea,
  ])

  const filteredBySupervisor = useMemo(() => {
    if (!report || supervisorFilter === "all") {
      return report
    }

    if ((report.profile.supervisorName ?? "") !== supervisorFilter) {
      return null
    }

    return report
  }, [report, supervisorFilter])

  const filteredActivity = useMemo(
    () =>
      filterEmployeeActivityByKpi(
        filteredBySupervisor?.activity ?? [],
        activeKpiKey
      ),
    [filteredBySupervisor, activeKpiKey]
  )

  const isLoading =
    !isAuthReady ||
    !isEmployeesReady ||
    !isTasksReady ||
    !isCrewsReady ||
    atencionLoading

  const value = useMemo(
    () => ({
      employeeId,
      setEmployeeId,
      areaFilter,
      setAreaFilter,
      supervisorFilter,
      setSupervisorFilter,
      period,
      setPeriod,
      customStartDate,
      setCustomStartDate,
      customEndDate,
      setCustomEndDate,
      activeKpiKey,
      setActiveKpiKey,
      employeeOptions,
      supervisorOptions,
      report: filteredBySupervisor,
      filteredActivity,
      isLoading,
      error: atencionError,
    }),
    [
      employeeId,
      areaFilter,
      supervisorFilter,
      period,
      customStartDate,
      customEndDate,
      activeKpiKey,
      employeeOptions,
      supervisorOptions,
      filteredBySupervisor,
      filteredActivity,
      isLoading,
      atencionError,
    ]
  )

  return (
    <EmployeeReportsContext.Provider value={value}>
      {children}
    </EmployeeReportsContext.Provider>
  )
}

export function useEmployeeReports() {
  const context = useContext(EmployeeReportsContext)
  if (!context) {
    throw new Error(
      "useEmployeeReports must be used within EmployeeReportsProvider"
    )
  }
  return context
}
