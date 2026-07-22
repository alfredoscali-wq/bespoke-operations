import {
  ACTIVITY_ACTION_DEFINITIONS,
  isActivityAction,
} from "@/lib/activity/catalog"
import {
  ACTIVITY_ENTITY_TYPES,
  ACTIVITY_MODULES,
  ACTIVITY_ORIGINS,
  ACTIVITY_SEVERITIES,
  type ActivityEntityType,
  type ActivityModule,
  type ActivityOrigin,
  type ActivitySeverity,
} from "@/lib/activity/types"
import {
  COMPANY_AREA_LABELS,
  FIXED_COMPANY_AREA_CODES,
  type FixedCompanyAreaCode,
} from "@/lib/roles/company-areas"

const MODULE_LABELS: Record<ActivityModule, string> = {
  [ACTIVITY_MODULES.TASKS]: "Órdenes de Trabajo",
  [ACTIVITY_MODULES.PROJECTS]: "Obras",
  [ACTIVITY_MODULES.PLANNING]: "Planificación",
  [ACTIVITY_MODULES.ATENCION]: "Atención",
  [ACTIVITY_MODULES.CUSTOMERS]: "Clientes",
  [ACTIVITY_MODULES.RRHH]: "RRHH",
  [ACTIVITY_MODULES.CREWS]: "Cuadrillas",
  [ACTIVITY_MODULES.USERS]: "Usuarios",
  [ACTIVITY_MODULES.INCIDENTS]: "Incidencias",
  [ACTIVITY_MODULES.MOBILE]: "Mobile",
  [ACTIVITY_MODULES.DEVICES]: "Dispositivos",
  [ACTIVITY_MODULES.EVIDENCE]: "Evidencias",
  [ACTIVITY_MODULES.MATERIALS]: "Materiales",
  [ACTIVITY_MODULES.REPORTS]: "Reportes",
  [ACTIVITY_MODULES.SETTINGS]: "Configuración",
  [ACTIVITY_MODULES.SYSTEM]: "Sistema",
}

const ENTITY_TYPE_LABELS: Record<ActivityEntityType, string> = {
  [ACTIVITY_ENTITY_TYPES.TASK]: "Orden de trabajo",
  [ACTIVITY_ENTITY_TYPES.PROJECT]: "Obra",
  [ACTIVITY_ENTITY_TYPES.PLANNING_DAY]: "Día de planificación",
  [ACTIVITY_ENTITY_TYPES.CUSTOMER_ATENCION]: "Atención de cliente",
  [ACTIVITY_ENTITY_TYPES.CUSTOMER]: "Cliente",
  [ACTIVITY_ENTITY_TYPES.EMPLOYEE]: "Empleado",
  [ACTIVITY_ENTITY_TYPES.CREW]: "Cuadrilla",
  [ACTIVITY_ENTITY_TYPES.USER]: "Usuario",
  [ACTIVITY_ENTITY_TYPES.SESSION]: "Sesión",
  [ACTIVITY_ENTITY_TYPES.INCIDENT]: "Incidencia",
  [ACTIVITY_ENTITY_TYPES.MOBILE_DEVICE]: "Dispositivo móvil",
  [ACTIVITY_ENTITY_TYPES.WORK_TEAM_SHIFT]: "Turno",
  [ACTIVITY_ENTITY_TYPES.EVIDENCE]: "Evidencia",
  [ACTIVITY_ENTITY_TYPES.MATERIAL]: "Material",
  [ACTIVITY_ENTITY_TYPES.SETTING]: "Configuración",
  [ACTIVITY_ENTITY_TYPES.REPORT_RUN]: "Ejecución de reporte",
  [ACTIVITY_ENTITY_TYPES.IMPORT_BATCH]: "Importación",
  [ACTIVITY_ENTITY_TYPES.AUDIT_EXPORT]: "Exportación de auditoría",
}

const ORIGIN_LABELS: Record<ActivityOrigin, string> = {
  [ACTIVITY_ORIGINS.WEB]: "Web",
  [ACTIVITY_ORIGINS.MOBILE]: "Mobile",
  [ACTIVITY_ORIGINS.API]: "API",
  [ACTIVITY_ORIGINS.CRON]: "Cron",
  [ACTIVITY_ORIGINS.SYSTEM]: "Sistema",
}

const SEVERITY_LABELS: Record<ActivitySeverity, string> = {
  [ACTIVITY_SEVERITIES.INFO]: "Info",
  [ACTIVITY_SEVERITIES.WARNING]: "Advertencia",
  [ACTIVITY_SEVERITIES.CRITICAL]: "Crítico",
}

export function formatActivityModuleLabel(module: string): string {
  return MODULE_LABELS[module as ActivityModule] ?? module
}

export function formatActivityEntityTypeLabel(entityType: string): string {
  return ENTITY_TYPE_LABELS[entityType as ActivityEntityType] ?? entityType
}

export function formatActivityOriginLabel(origin: string): string {
  return ORIGIN_LABELS[origin as ActivityOrigin] ?? origin
}

export function formatActivitySeverityLabel(severity: string): string {
  return SEVERITY_LABELS[severity as ActivitySeverity] ?? severity
}

export function formatActivityActionLabel(action: string): string {
  if (isActivityAction(action)) {
    return ACTIVITY_ACTION_DEFINITIONS[action].label
  }
  return action
}

export function formatActivityAreaLabel(areaCode: string | null | undefined): string {
  if (!areaCode) return "—"
  if (areaCode in COMPANY_AREA_LABELS) {
    return COMPANY_AREA_LABELS[areaCode as FixedCompanyAreaCode]
  }
  return areaCode
}

export function listActivityViewerModules(): Array<{
  value: ActivityModule
  label: string
}> {
  return (Object.values(ACTIVITY_MODULES) as ActivityModule[]).map((value) => ({
    value,
    label: MODULE_LABELS[value],
  }))
}

export function listActivityViewerOrigins(): Array<{
  value: ActivityOrigin
  label: string
}> {
  return (Object.values(ACTIVITY_ORIGINS) as ActivityOrigin[]).map((value) => ({
    value,
    label: ORIGIN_LABELS[value],
  }))
}

export function listActivityViewerAreas(): Array<{
  value: FixedCompanyAreaCode
  label: string
}> {
  return FIXED_COMPANY_AREA_CODES.map((value) => ({
    value,
    label: COMPANY_AREA_LABELS[value],
  }))
}

export function listActivityViewerActions(): Array<{
  value: string
  label: string
}> {
  return Object.entries(ACTIVITY_ACTION_DEFINITIONS)
    .map(([value, definition]) => ({
      value,
      label: `${definition.label} (${value})`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "es"))
}

export function formatActivityDisplayTimestamp(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date)
}

export function formatActivityMetadataJson(
  metadata: Record<string, unknown> | null | undefined
): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "{}"
  }

  try {
    return JSON.stringify(metadata, null, 2)
  } catch {
    return String(metadata)
  }
}
