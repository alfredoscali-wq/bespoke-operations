import type { CustomerQuickFilter } from "@/lib/customers/customer-operational"
import type { ProjectHealth } from "@/lib/projects/project-operational-metrics"
import type { OperationalProjectCategory } from "@/lib/projects/operational-project-category"
import type { OperationalTaskCategory } from "@/lib/tasks/operational-category"
import type {
  EmployeeSummary,
  EmployeeFilters,
  EmploymentStatus,
  SystemRole,
} from "@/lib/types/employees"
import type { CrewStatus } from "@/lib/types/crews"
import type { ProjectStatus } from "@/lib/types/projects"
import type { TaskStatus } from "@/lib/types/tasks"

const PROJECT_STATUS_VALUES: ProjectStatus[] = [
  "planned",
  "active",
  "paused",
  "pending-closure",
  "closed",
  "cancelled",
]

const TASK_STATUS_VALUES: TaskStatus[] = [
  "pendiente",
  "asignada",
  "vencida",
  "en-curso",
  "incidencia",
  "pendiente-cierre",
  "en-aprobacion",
  "finalizada",
  "cerrada",
  "cancelada",
]

const CUSTOMER_QUICK_FILTER_VALUES: CustomerQuickFilter[] = [
  "operativos",
  "activos",
  "revisar",
]

const TASK_CATEGORY_VALUES: OperationalTaskCategory[] = [
  "sin-cuadrilla",
  "programadas",
  "vencidas",
  "suspendidas",
  "completadas",
  "canceladas",
]

const PROJECT_CATEGORY_VALUES: OperationalProjectCategory[] = [
  "sin-iniciar",
  "en-ejecucion",
  "detenida",
  "finalizada",
  "cancelada",
]

const EMPLOYMENT_STATUS_VALUES: EmploymentStatus[] = [
  "active",
  "vacation",
  "medical_leave",
  "training",
  "suspended",
  "inactive",
]

const SYSTEM_ROLE_VALUES: SystemRole[] = [
  "administrador",
  "supervisor",
  "administrativo",
  "operario",
]

const CREW_STATUS_VALUES: CrewStatus[] = ["activa", "inactiva", "en-campo"]

const PROJECT_HEALTH_VALUES: ProjectHealth[] = ["healthy", "risk", "overdue"]

export function parseProjectStatusQuery(
  value: string | null
): ProjectStatus | "all" {
  if (!value) return "all"
  return PROJECT_STATUS_VALUES.includes(value as ProjectStatus)
    ? (value as ProjectStatus)
    : "all"
}

export function parseTaskStatusQuery(value: string | null): TaskStatus | "all" {
  if (!value) return "all"
  return TASK_STATUS_VALUES.includes(value as TaskStatus)
    ? (value as TaskStatus)
    : "all"
}

export function parseCustomerQuickFilterQuery(
  value: string | null
): CustomerQuickFilter {
  if (!value) return "operativos"
  return CUSTOMER_QUICK_FILTER_VALUES.includes(value as CustomerQuickFilter)
    ? (value as CustomerQuickFilter)
    : "operativos"
}

export function parseTaskOperationalCategoryQuery(
  value: string | null
): OperationalTaskCategory | null {
  if (!value) return null
  return TASK_CATEGORY_VALUES.includes(value as OperationalTaskCategory)
    ? (value as OperationalTaskCategory)
    : null
}

export function parseProjectOperationalCategoryQuery(
  value: string | null
): OperationalProjectCategory | null {
  if (!value) return null
  return PROJECT_CATEGORY_VALUES.includes(value as OperationalProjectCategory)
    ? (value as OperationalProjectCategory)
    : null
}

export function parseProjectHealthQuery(value: string | null): ProjectHealth | "all" {
  if (!value) return "all"
  return PROJECT_HEALTH_VALUES.includes(value as ProjectHealth)
    ? (value as ProjectHealth)
    : "all"
}

export function parseEmploymentStatusQuery(
  value: string | null
): EmploymentStatus | "all" {
  if (!value) return "all"
  return EMPLOYMENT_STATUS_VALUES.includes(value as EmploymentStatus)
    ? (value as EmploymentStatus)
    : "all"
}

export function parseSystemRoleQuery(value: string | null): SystemRole | "all" {
  if (!value) return "all"
  return SYSTEM_ROLE_VALUES.includes(value as SystemRole)
    ? (value as SystemRole)
    : "all"
}

export function parseCrewStatusQuery(value: string | null): CrewStatus | "all" {
  if (!value) return "all"
  return CREW_STATUS_VALUES.includes(value as CrewStatus)
    ? (value as CrewStatus)
    : "all"
}

export type EmployeeProvisionFilter = "all" | "pending" | "provisioned"

export function parseEmployeeProvisionQuery(
  value: string | null
): EmployeeProvisionFilter {
  if (value === "pending" || value === "provisioned") return value
  return "all"
}

export function buildModuleUrl(
  path: string,
  params: Record<string, string | undefined | null>
): string {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value)
    }
  }

  const query = search.toString()
  return query ? `${path}?${query}` : path
}

export const moduleFilterUrls = {
  tasks: {
    status: (status: TaskStatus) =>
      buildModuleUrl("/tareas", { status }),
    category: (category: OperationalTaskCategory) =>
      buildModuleUrl("/tareas", { category }),
  },
  projects: {
    status: (status: ProjectStatus) =>
      buildModuleUrl("/obras", { status }),
    category: (category: OperationalProjectCategory) =>
      buildModuleUrl("/obras", { category }),
    health: (health: ProjectHealth) =>
      buildModuleUrl("/obras", { health }),
  },
  customers: {
    quickFilter: (filter: CustomerQuickFilter) =>
      buildModuleUrl("/clientes", { filter }),
  },
  employees: {
    fromSummaryKey: (key: keyof EmployeeSummary) => {
      const filters = employeeSummaryKeyToFilters(key)
      return buildModuleUrl("/rrhh", {
        employmentStatus:
          filters.employmentStatus !== "all"
            ? filters.employmentStatus
            : undefined,
        systemRole:
          filters.systemRole !== "all" ? filters.systemRole : undefined,
        provision:
          filters.provision !== "all" ? filters.provision : undefined,
        systemAccess:
          filters.systemAccess !== "all" ? filters.systemAccess : undefined,
      })
    },
  },
  crews: {
    status: (status: CrewStatus) =>
      buildModuleUrl("/cuadrillas", { status }),
  },
} as const

export function employeeSummaryKeyToFilters(
  key: keyof EmployeeSummary
): Pick<
  EmployeeFilters,
  "employmentStatus" | "systemRole" | "systemAccess" | "provision"
> {
  switch (key) {
    case "active":
      return {
        employmentStatus: "active",
        systemRole: "all",
        systemAccess: "all",
        provision: "all",
      }
    case "vacation":
      return {
        employmentStatus: "vacation",
        systemRole: "all",
        systemAccess: "all",
        provision: "all",
      }
    case "medicalLeave":
      return {
        employmentStatus: "medical_leave",
        systemRole: "all",
        systemAccess: "all",
        provision: "all",
      }
    case "training":
      return {
        employmentStatus: "training",
        systemRole: "all",
        systemAccess: "all",
        provision: "all",
      }
    case "suspended":
      return {
        employmentStatus: "suspended",
        systemRole: "all",
        systemAccess: "all",
        provision: "all",
      }
    case "inactive":
      return {
        employmentStatus: "inactive",
        systemRole: "all",
        systemAccess: "all",
        provision: "all",
      }
    case "administradores":
      return {
        employmentStatus: "all",
        systemRole: "administrador",
        systemAccess: "all",
        provision: "all",
      }
    case "supervisores":
      return {
        employmentStatus: "all",
        systemRole: "supervisor",
        systemAccess: "all",
        provision: "all",
      }
    case "administrativos":
      return {
        employmentStatus: "all",
        systemRole: "administrativo",
        systemAccess: "all",
        provision: "all",
      }
    case "operarios":
      return {
        employmentStatus: "all",
        systemRole: "operario",
        systemAccess: "all",
        provision: "all",
      }
    case "provisionedUsers":
      return {
        employmentStatus: "all",
        systemRole: "all",
        systemAccess: "all",
        provision: "provisioned",
      }
    case "pendingProvision":
      return {
        employmentStatus: "all",
        systemRole: "all",
        systemAccess: "all",
        provision: "pending",
      }
    default:
      return {
        employmentStatus: "all",
        systemRole: "all",
        systemAccess: "all",
        provision: "all",
      }
  }
}

export function taskStatusToOperationalCategory(
  status: TaskStatus
): OperationalTaskCategory | null {
  switch (status) {
    case "asignada":
      return "programadas"
    case "vencida":
      return "vencidas"
    case "pendiente-cierre":
    case "en-aprobacion":
      return "suspendidas"
    case "finalizada":
    case "cerrada":
      return "completadas"
    case "cancelada":
      return "canceladas"
    default:
      return null
  }
}
