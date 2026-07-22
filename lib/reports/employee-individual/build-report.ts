import type { EquipoIndividualReport } from "@/lib/atencion-cliente-equipo/report"
import {
  EMPLOYEE_REPORT_AREA_LABELS,
  resolveEmployeeReportArea,
  type EmployeeReportArea,
} from "@/lib/reports/employee-individual/areas"
import {
  isDateWithinEmployeeReportBounds,
  type EmployeeReportPeriod,
  type EmployeeReportPeriodBounds,
} from "@/lib/reports/employee-individual/period"
import type {
  EmployeeActivityRow,
  EmployeeIndividualReport,
  EmployeeReportKpi,
  EmployeeReportProfile,
} from "@/lib/reports/employee-individual/types"
import { TASK_STATUS_LABELS } from "@/lib/tasks/constants"
import { taskMatchesCrewId } from "@/lib/tasks/crew-relation"
import { isTaskVencida } from "@/lib/tasks/vencida-status"
import {
  WORK_ORDER_SERVICE_TYPE_LABELS,
  type WorkOrderServiceType,
} from "@/lib/tasks/work-order"
import { getEmployeeDisplayName } from "@/lib/employees/utils"
import type { Crew } from "@/lib/types/crews"
import type { Employee } from "@/lib/types/employees"
import type { EmployeeAvailability } from "@/lib/types/availability"
import type { Task, TaskStatus } from "@/lib/types/tasks"
import { extractDatePortion } from "@/lib/reports/report-utils"

function kpi(
  key: string,
  label: string,
  value: number | string
): EmployeeReportKpi {
  const numericValue = typeof value === "number" ? value : Number(value) || 0
  return { key, label, value, numericValue }
}

function formatDurationHours(hours: number | null): string {
  if (hours == null || !Number.isFinite(hours)) {
    return "—"
  }
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`
  }
  return `${hours.toFixed(1)} h`
}

function averageHours(values: number[]): number | null {
  if (values.length === 0) {
    return null
  }
  const sum = values.reduce((acc, value) => acc + value, 0)
  return sum / values.length
}

function taskDurationHours(task: Task): number | null {
  const start = task.createdAt ? Date.parse(task.createdAt) : Number.NaN
  const end = task.completedAt
    ? Date.parse(task.completedAt)
    : task.closedAt
      ? Date.parse(task.closedAt)
      : Number.NaN

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return null
  }

  return (end - start) / (1000 * 60 * 60)
}

function serviceTypeLabel(task: Task): string {
  const serviceType = task.serviceType?.trim()
  if (!serviceType) {
    return TASK_STATUS_LABELS[task.status] ? task.type : task.type
  }
  return (
    WORK_ORDER_SERVICE_TYPE_LABELS[serviceType as WorkOrderServiceType] ??
    serviceType
  )
}

function taskInPeriod(task: Task, bounds: EmployeeReportPeriodBounds): boolean {
  return (
    isDateWithinEmployeeReportBounds(task.dueDate, bounds) ||
    isDateWithinEmployeeReportBounds(task.completedAt, bounds) ||
    isDateWithinEmployeeReportBounds(task.createdAt, bounds) ||
    isDateWithinEmployeeReportBounds(task.rescheduledAt, bounds)
  )
}

function resolveSupervisorName(
  employee: Employee,
  crews: Crew[],
  employees: Employee[]
): string | null {
  const supervisedBy = crews.find(
    (crew) =>
      crew.supervisorEmployeeId &&
      crew.members.some(
        (member) => member.active && member.employeeId === employee.id
      )
  )

  if (supervisedBy?.supervisorEmployeeId) {
    const supervisor = employees.find(
      (item) => item.id === supervisedBy.supervisorEmployeeId
    )
    if (supervisor) {
      return getEmployeeDisplayName(supervisor)
    }
    if (supervisedBy.supervisor.trim()) {
      return supervisedBy.supervisor.trim()
    }
  }

  return null
}

export function buildEmployeeReportProfile(
  employee: Employee,
  crews: Crew[],
  employees: Employee[]
): EmployeeReportProfile {
  const area = resolveEmployeeReportArea(employee)

  return {
    employeeId: employee.id,
    displayName: getEmployeeDisplayName(employee),
    jobTitle: employee.jobTitle?.trim() || "—",
    department: employee.department?.trim() || "—",
    area,
    areaLabel: EMPLOYEE_REPORT_AREA_LABELS[area],
    supervisorName: resolveSupervisorName(employee, crews, employees),
    employmentStatus: employee.employmentStatus,
    hireDate: employee.hireDate?.trim() || null,
  }
}

function crewIdsForMember(employeeId: string, crews: Crew[]): string[] {
  return crews
    .filter((crew) =>
      crew.members.some(
        (member) => member.active && member.employeeId === employeeId
      )
    )
    .map((crew) => crew.id)
}

function crewIdsForSupervisor(employeeId: string, crews: Crew[]): string[] {
  return crews
    .filter((crew) => crew.supervisorEmployeeId === employeeId)
    .map((crew) => crew.id)
}

function tasksForCrewIds(
  tasks: Task[],
  crewIds: string[],
  crews: Crew[],
  bounds: EmployeeReportPeriodBounds
): Task[] {
  if (crewIds.length === 0) {
    return []
  }

  const scopedCrews = crews.filter((crew) => crewIds.includes(crew.id))

  return tasks.filter((task) => {
    if (!taskInPeriod(task, bounds)) {
      return false
    }
    return scopedCrews.some((crew) => taskMatchesCrewId(task, crew))
  })
}

function toOtActivityRow(
  task: Task,
  kpiKeys: string[]
): EmployeeActivityRow {
  const duration = taskDurationHours(task)
  const statusLabel = TASK_STATUS_LABELS[task.status] ?? task.status

  return {
    id: task.id,
    date:
      extractDatePortion(task.completedAt) ??
      extractDatePortion(task.dueDate) ??
      extractDatePortion(task.createdAt) ??
      "—",
    customer: task.customerName?.trim() || task.title?.trim() || "—",
    reference: task.code || task.workOrderNumber || task.id.slice(0, 8),
    type: serviceTypeLabel(task),
    status: statusLabel,
    durationLabel: formatDurationHours(duration),
    result: task.rejectionReason?.trim() || statusLabel,
    supervisor: task.supervisor?.trim() || "—",
    kind: "ot",
    kpiKeys,
  }
}

function collectOtKpiKeys(task: Task): string[] {
  const keys = new Set<string>(["ot_asignadas"])

  const status: TaskStatus = task.status
  if (status === "finalizada" || status === "cerrada") {
    keys.add("ot_finalizadas")
  }
  if (
    status === "programada" ||
    status === "asignada" ||
    status === "en-curso" ||
    status === "en-aprobacion"
  ) {
    keys.add("ot_pendientes")
  }
  if (status === "cancelada") {
    keys.add("ot_canceladas")
  }
  if (task.rescheduledAt || task.originalScheduledDate) {
    keys.add("ot_reprogramadas")
  }
  if (isTaskVencida(task)) {
    keys.add("ot_vencidas")
  }
  if (status === "incidencia") {
    keys.add("incidencias_creadas")
  }
  if (status === "pendiente-cierre" || status === "en-aprobacion") {
    keys.add("pendientes_cierre")
  }
  if (task.type === "fiber") {
    keys.add("ot_fibra")
  }
  if (task.type === "wireless") {
    keys.add("ot_wireless")
  }
  if (task.serviceType === "instalacion-nueva") {
    keys.add("instalaciones")
  }
  if (task.serviceType === "service-tecnico") {
    keys.add("services")
  }
  if (task.serviceType === "cambio-domicilio") {
    keys.add("cambios_domicilio")
  }
  if (task.serviceType === "cambio-tecnologia") {
    keys.add("cambios_tecnologia")
  }

  return [...keys]
}

function buildTechnicalKpisAndActivity(
  tasks: Task[]
): { kpis: EmployeeReportKpi[]; activity: EmployeeActivityRow[] } {
  const withKeys = tasks.map((task) => ({
    task,
    keys: collectOtKpiKeys(task),
  }))

  const count = (key: string) =>
    withKeys.filter((item) => item.keys.includes(key)).length

  const durations = tasks
    .map(taskDurationHours)
    .filter((value): value is number => value != null)

  const kpis: EmployeeReportKpi[] = [
    kpi("ot_asignadas", "OT asignadas", tasks.length),
    kpi("ot_finalizadas", "OT finalizadas", count("ot_finalizadas")),
    kpi("ot_pendientes", "OT pendientes", count("ot_pendientes")),
    kpi("ot_canceladas", "OT canceladas", count("ot_canceladas")),
    kpi("ot_reprogramadas", "OT reprogramadas", count("ot_reprogramadas")),
    kpi("ot_vencidas", "OT vencidas", count("ot_vencidas")),
    kpi(
      "tiempo_promedio_ot",
      "Tiempo promedio por OT",
      formatDurationHours(averageHours(durations))
    ),
    kpi("incidencias_creadas", "Incidencias creadas", count("incidencias_creadas")),
    kpi("pendientes_cierre", "Pendientes de cierre", count("pendientes_cierre")),
    kpi("ot_fibra", "OT Fibra", count("ot_fibra")),
    kpi("ot_wireless", "OT Wireless", count("ot_wireless")),
    kpi("instalaciones", "Instalaciones", count("instalaciones")),
    kpi("services", "Services", count("services")),
    kpi("cambios_domicilio", "Cambios de domicilio", count("cambios_domicilio")),
    kpi("cambios_tecnologia", "Cambios de tecnología", count("cambios_tecnologia")),
  ]

  const activity = withKeys.map(({ task, keys }) => toOtActivityRow(task, keys))

  return { kpis, activity }
}

function collectSupervisionKpiKeys(task: Task): string[] {
  const keys = new Set<string>()
  const status = task.status

  if (status === "finalizada" || status === "cerrada") {
    keys.add("ot_aprobadas")
  }
  if (task.rejectionReason?.trim()) {
    keys.add("ot_rechazadas")
  }
  if (status === "cancelada") {
    keys.add("ot_canceladas")
  }
  if (task.rescheduledAt || task.originalScheduledDate) {
    keys.add("ot_reprogramadas")
  }
  if (status === "pendiente-cierre" || status === "en-aprobacion") {
    keys.add("pendientes_cierre")
  }

  return [...keys]
}

function buildSupervisionKpisAndActivity(
  tasks: Task[]
): { kpis: EmployeeReportKpi[]; activity: EmployeeActivityRow[] } {
  const withKeys = tasks.map((task) => ({
    task,
    keys: collectSupervisionKpiKeys(task),
  }))

  const count = (key: string) =>
    withKeys.filter((item) => item.keys.includes(key)).length

  const approvalDurations = tasks
    .filter((task) => task.status === "finalizada" || task.status === "cerrada")
    .map(taskDurationHours)
    .filter((value): value is number => value != null)

  const kpis: EmployeeReportKpi[] = [
    kpi("ot_aprobadas", "OT aprobadas", count("ot_aprobadas")),
    kpi("ot_rechazadas", "OT rechazadas", count("ot_rechazadas")),
    kpi("ot_canceladas", "OT canceladas", count("ot_canceladas")),
    kpi("ot_reprogramadas", "OT reprogramadas", count("ot_reprogramadas")),
    kpi("pendientes_cierre", "Pendientes de cierre", count("pendientes_cierre")),
    kpi(
      "tiempo_promedio_aprobacion",
      "Tiempo promedio de aprobación",
      formatDurationHours(averageHours(approvalDurations))
    ),
  ]

  const activity = withKeys
    .filter((item) => item.keys.length > 0)
    .map(({ task, keys }) => toOtActivityRow(task, keys))

  return { kpis, activity }
}

export function mapEquipoReportToEmployeeKpis(
  report: EquipoIndividualReport
): { kpis: EmployeeReportKpi[]; activity: EmployeeActivityRow[] } {
  const kpis: EmployeeReportKpi[] = [
    kpi("consultas", "Consultas", report.kpis.atenciones),
    kpi("resueltas", "Resueltas", report.kpis.resueltas),
    kpi("pendientes", "Pendientes", report.kpis.seguimientosPendientes),
    kpi("derivadas", "Derivadas", report.kpis.seguimientosCompletados),
    kpi("ot_generadas", "OT generadas", 0),
    kpi("retenciones", "Retenciones", report.kpis.retencionesGestionadas),
    kpi("ventas_derivadas", "Ventas derivadas", 0),
    kpi("tiempo_promedio", "Tiempo promedio", "—"),
  ]

  const activity: EmployeeActivityRow[] = report.activity.map((entry) => {
    const keys: string[] = ["consultas"]
    if (entry.kind === "atencion" && entry.tone === "green") {
      keys.push("resueltas")
    }
    if (entry.kind === "seguimiento") {
      keys.push(entry.tone === "green" ? "derivadas" : "pendientes")
    }
    if (entry.kind === "retencion") {
      keys.push("retenciones")
    }

    return {
      id: entry.id,
      date: entry.occurredAt.slice(0, 10),
      customer: entry.customerName,
      reference: entry.id.slice(0, 8),
      type: entry.title,
      status: entry.subtitle,
      durationLabel: "—",
      result: entry.subtitle,
      supervisor: "—",
      kind: "atencion",
      kpiKeys: keys,
    }
  })

  return { kpis, activity }
}

function buildVentasPlaceholders(): {
  kpis: EmployeeReportKpi[]
  activity: EmployeeActivityRow[]
} {
  return {
    kpis: [
      kpi("clientes_contactados", "Clientes contactados", 0),
      kpi("ventas_cerradas", "Ventas cerradas", 0),
      kpi("ventas_perdidas", "Ventas perdidas", 0),
      kpi("monto_vendido", "Monto vendido", 0),
      kpi("conversion", "Conversión", "0%"),
      kpi("tiempo_promedio_cierre", "Tiempo promedio de cierre", "—"),
      kpi("clientes_derivados", "Clientes derivados", 0),
    ],
    activity: [],
  }
}

function buildRrhhKpisAndActivity(input: {
  employeeId: string
  employees: Employee[]
  crews: Crew[]
  availability: EmployeeAvailability[]
  bounds: EmployeeReportPeriodBounds
}): { kpis: EmployeeReportKpi[]; activity: EmployeeActivityRow[] } {
  const createdEmployees = input.employees.filter((employee) =>
    isDateWithinEmployeeReportBounds(employee.createdAt, input.bounds)
  )
  const activatedUsers = input.employees.filter(
    (employee) =>
      Boolean(employee.appUserId) &&
      isDateWithinEmployeeReportBounds(
        employee.lastLoginAt ?? employee.updatedAt ?? employee.createdAt,
        input.bounds
      )
  )
  const availabilities = input.availability.filter((record) =>
    isDateWithinEmployeeReportBounds(record.createdAt ?? record.startDate, input.bounds)
  )
  const managedCrews = input.crews.filter(
    (crew) => crew.supervisorEmployeeId === input.employeeId
  )

  const activity: EmployeeActivityRow[] = [
    ...createdEmployees.map((employee) => ({
      id: `emp-created-${employee.id}`,
      date: extractDatePortion(employee.createdAt) ?? "—",
      customer: "—",
      reference: employee.employeeCode,
      type: "Alta de empleado",
      status: employee.employmentStatus,
      durationLabel: "—",
      result: getEmployeeDisplayName(employee),
      supervisor: "—",
      kind: "rrhh" as const,
      kpiKeys: ["empleados_creados"],
    })),
    ...activatedUsers.map((employee) => ({
      id: `emp-activated-${employee.id}`,
      date:
        extractDatePortion(employee.lastLoginAt) ??
        extractDatePortion(employee.updatedAt) ??
        "—",
      customer: "—",
      reference: employee.employeeCode,
      type: "Usuario activado",
      status: employee.systemAccess ? "Con acceso" : "Sin acceso",
      durationLabel: "—",
      result: getEmployeeDisplayName(employee),
      supervisor: "—",
      kind: "rrhh" as const,
      kpiKeys: ["usuarios_activados"],
    })),
    ...availabilities.map((record) => ({
      id: `avail-${record.id}`,
      date: record.startDate,
      customer: "—",
      reference: record.id.slice(0, 8),
      type: "Disponibilidad",
      status: record.availabilityType,
      durationLabel: "—",
      result: record.reason?.trim() || record.availabilityType,
      supervisor: "—",
      kind: "rrhh" as const,
      kpiKeys: ["disponibilidades_cargadas"],
    })),
    ...managedCrews.map((crew) => ({
      id: `crew-${crew.id}`,
      date: input.bounds.endDate,
      customer: "—",
      reference: crew.name,
      type: "Cuadrilla administrada",
      status: crew.status,
      durationLabel: "—",
      result: `${crew.members.filter((member) => member.active).length} miembros`,
      supervisor: crew.supervisor || "—",
      kind: "rrhh" as const,
      kpiKeys: ["cuadrillas_administradas"],
    })),
  ]

  return {
    kpis: [
      kpi("empleados_creados", "Empleados creados", createdEmployees.length),
      kpi("usuarios_activados", "Usuarios activados", activatedUsers.length),
      kpi(
        "disponibilidades_cargadas",
        "Disponibilidades cargadas",
        availabilities.length
      ),
      kpi(
        "cuadrillas_administradas",
        "Cuadrillas administradas",
        managedCrews.length
      ),
    ],
    activity,
  }
}

export function buildEmployeeIndividualReport(input: {
  employee: Employee
  employees: Employee[]
  tasks: Task[]
  crews: Crew[]
  period: EmployeeReportPeriod
  bounds: EmployeeReportPeriodBounds
  availability?: EmployeeAvailability[]
  atencionReport?: EquipoIndividualReport | null
}): EmployeeIndividualReport {
  const profile = buildEmployeeReportProfile(
    input.employee,
    input.crews,
    input.employees
  )

  let kpis: EmployeeReportKpi[] = []
  let activity: EmployeeActivityRow[] = []

  switch (profile.area as EmployeeReportArea) {
    case "tecnica": {
      const memberCrewIds = crewIdsForMember(input.employee.id, input.crews)
      const scoped = tasksForCrewIds(
        input.tasks,
        memberCrewIds,
        input.crews,
        input.bounds
      )
      ;({ kpis, activity } = buildTechnicalKpisAndActivity(scoped))
      break
    }
    case "supervision": {
      const supervisedCrewIds = crewIdsForSupervisor(
        input.employee.id,
        input.crews
      )
      const scoped = tasksForCrewIds(
        input.tasks,
        supervisedCrewIds,
        input.crews,
        input.bounds
      )
      ;({ kpis, activity } = buildSupervisionKpisAndActivity(scoped))
      break
    }
    case "atencion": {
      if (input.atencionReport) {
        ;({ kpis, activity } = mapEquipoReportToEmployeeKpis(input.atencionReport))
      } else {
        kpis = [
          kpi("consultas", "Consultas", 0),
          kpi("resueltas", "Resueltas", 0),
          kpi("pendientes", "Pendientes", 0),
          kpi("derivadas", "Derivadas", 0),
          kpi("ot_generadas", "OT generadas", 0),
          kpi("retenciones", "Retenciones", 0),
          kpi("ventas_derivadas", "Ventas derivadas", 0),
          kpi("tiempo_promedio", "Tiempo promedio", "—"),
        ]
        activity = []
      }
      break
    }
    case "ventas": {
      ;({ kpis, activity } = buildVentasPlaceholders())
      break
    }
    case "rrhh": {
      ;({ kpis, activity } = buildRrhhKpisAndActivity({
        employeeId: input.employee.id,
        employees: input.employees,
        crews: input.crews,
        availability: input.availability ?? [],
        bounds: input.bounds,
      }))
      break
    }
    case "general":
    default: {
      const memberCrewIds = crewIdsForMember(input.employee.id, input.crews)
      const supervisedCrewIds = crewIdsForSupervisor(
        input.employee.id,
        input.crews
      )
      const scoped = tasksForCrewIds(
        input.tasks,
        [...new Set([...memberCrewIds, ...supervisedCrewIds])],
        input.crews,
        input.bounds
      )
      if (scoped.length > 0) {
        ;({ kpis, activity } = buildTechnicalKpisAndActivity(scoped))
      } else {
        kpis = []
        activity = []
      }
      break
    }
  }

  activity.sort((a, b) => b.date.localeCompare(a.date))

  return {
    profile,
    period: input.period,
    periodLabel: input.bounds.label,
    startDate: input.bounds.startDate,
    endDate: input.bounds.endDate,
    kpis,
    activity,
  }
}

export function filterEmployeeActivityByKpi(
  activity: EmployeeActivityRow[],
  kpiKey: string | null
): EmployeeActivityRow[] {
  if (!kpiKey) {
    return activity
  }

  return activity.filter((row) => row.kpiKeys.includes(kpiKey))
}
