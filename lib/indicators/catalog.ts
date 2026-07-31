import { ACTIVITY_EVENT_ACTIONS } from "@/lib/activity/actions"
import { ACTIVITY_ACTIONS as LEGACY_CS_ACTIONS } from "@/lib/activity-engine/activity-actions"
import type { IndicatorDefinition } from "@/lib/indicators/types"

const ALL_UNITS = [
  "employee",
  "crew",
  "project",
  "customer",
  "company",
] as const

const EMPLOYEE_COMPANY = ["employee", "company"] as const
const EMPLOYEE_CREW_COMPANY = ["employee", "crew", "company"] as const
const PROJECT_COMPANY = ["project", "company", "employee"] as const
const CUSTOMER_COMPANY = ["customer", "company", "employee"] as const

/**
 * Stable indicator identifiers. Reports reference these — never invent local KPIs.
 */
export const INDICATOR_IDS = {
  // Meta / span
  EVENTS_TOTAL: "events_total",
  FIRST_EVENT_AT: "first_event_at",
  LAST_EVENT_AT: "last_event_at",
  ACTIVE_TIME_MS: "active_time_ms",
  DISTINCT_MODULES: "distinct_modules",
  EMPLOYEES_ACTIVE: "employees_active",
  CREWS_ACTIVE: "crews_active",
  PROJECTS_ACTIVE: "projects_active",

  // Clientes
  CUSTOMERS_CREATED: "customers_created",
  CUSTOMERS_UPDATED: "customers_updated",

  // Atención
  ATTENTIONS_CREATED: "attentions_created",
  ATTENTIONS_RESOLVED: "attentions_resolved",
  ATTENTIONS_TRANSFERRED: "attentions_transferred",
  ATTENTIONS_WORKORDERS_GENERATED: "attentions_workorders_generated",
  RETENTIONS: "retentions",

  // Comercial / solicitudes
  REQUESTS_CREATED: "requests_created",
  REQUESTS_RESOLVED: "requests_resolved",
  COMMERCIAL_ACTIVITIES: "commercial_activities",
  COMMERCIAL_COMPLETED: "commercial_completed",

  // OT
  WORKORDERS_CREATED: "workorders_created",
  WORKORDERS_ASSIGNED: "workorders_assigned",
  WORKORDERS_STARTED: "workorders_started",
  WORKORDERS_FINISHED: "workorders_finished",
  WORKORDERS_RESCHEDULED: "workorders_rescheduled",
  WORKORDERS_CANCELLED: "workorders_cancelled",

  // Obras
  PROJECTS_CREATED: "projects_created",
  PROJECTS_UPDATED: "projects_updated",
  PROJECTS_STARTED: "projects_started",
  PROJECTS_FINISHED: "projects_finished",

  // Config
  SETTINGS_UPDATED: "settings_updated",

  /**
   * Transitional module-bucket indicators (compat with Ops / Workforce cards).
   * Prefer production indicators above for new reports.
   */
  BUCKET_CUSTOMERS: "bucket_customers",
  BUCKET_REQUESTS: "bucket_requests",
  BUCKET_WORK_ORDERS: "bucket_work_orders",
  BUCKET_ATTENTIONS: "bucket_attentions",
  BUCKET_COMMERCIAL: "bucket_commercial",
  BUCKET_PROJECTS: "bucket_projects",
  BUCKET_SETTINGS: "bucket_settings",
} as const

export type IndicatorId =
  (typeof INDICATOR_IDS)[keyof typeof INDICATOR_IDS]

/**
 * Central Indicator catalog.
 * All calculation rules for production reports live here.
 */
export const INDICATOR_CATALOG: readonly IndicatorDefinition[] = [
  {
    id: INDICATOR_IDS.EVENTS_TOTAL,
    name: "Eventos totales",
    description: "Cantidad total de eventos de actividad en el período.",
    unit: "count",
    calculation: "count_matching_events",
    analysisUnits: ALL_UNITS,
  },
  {
    id: INDICATOR_IDS.FIRST_EVENT_AT,
    name: "Primer evento",
    description: "Marca temporal del primer evento del período.",
    unit: "timestamp_iso",
    calculation: "min_created_at",
    analysisUnits: ALL_UNITS,
  },
  {
    id: INDICATOR_IDS.LAST_EVENT_AT,
    name: "Último evento",
    description: "Marca temporal del último evento del período.",
    unit: "timestamp_iso",
    calculation: "max_created_at",
    analysisUnits: ALL_UNITS,
  },
  {
    id: INDICATOR_IDS.ACTIVE_TIME_MS,
    name: "Tiempo activo",
    description:
      "Intervalo entre el primer y el último evento del período (aprox. jornada).",
    unit: "milliseconds",
    calculation: "span_first_to_last_ms",
    analysisUnits: EMPLOYEE_COMPANY,
  },
  {
    id: INDICATOR_IDS.DISTINCT_MODULES,
    name: "Módulos distintos",
    description: "Cantidad de módulos canónicos con al menos un evento.",
    unit: "count",
    calculation: "count_distinct_canonical_modules",
    analysisUnits: EMPLOYEE_COMPANY,
  },
  {
    id: INDICATOR_IDS.EMPLOYEES_ACTIVE,
    name: "Empleados activos",
    description: "Empleados distintos con al menos un evento en el período.",
    unit: "count",
    calculation: "count_distinct_employee_ids",
    analysisUnits: ["company", "crew", "project"],
  },
  {
    id: INDICATOR_IDS.CREWS_ACTIVE,
    name: "Cuadrillas activas",
    description: "Cuadrillas distintas con actividad en el período.",
    unit: "count",
    calculation: "count_distinct_entity_ids",
    entityTypes: ["crew"],
    analysisUnits: ["company", "employee"],
  },
  {
    id: INDICATOR_IDS.PROJECTS_ACTIVE,
    name: "Obras activas",
    description: "Obras distintas con actividad en el período.",
    unit: "count",
    calculation: "count_distinct_entity_ids",
    entityTypes: ["project"],
    analysisUnits: ["company", "employee", "crew"],
  },

  {
    id: INDICATOR_IDS.CUSTOMERS_CREATED,
    name: "Clientes nuevos",
    description: "Clientes creados en el período.",
    unit: "count",
    calculation: "count_matching_events",
    actions: [ACTIVITY_EVENT_ACTIONS.CUSTOMER_CREATED],
    analysisUnits: CUSTOMER_COMPANY,
  },
  {
    id: INDICATOR_IDS.CUSTOMERS_UPDATED,
    name: "Clientes modificados",
    description: "Actualizaciones, archivo, reactivación o etiquetas de clientes.",
    unit: "count",
    calculation: "count_matching_events",
    actions: [
      ACTIVITY_EVENT_ACTIONS.CUSTOMER_UPDATED,
      ACTIVITY_EVENT_ACTIONS.CUSTOMER_ARCHIVED,
      ACTIVITY_EVENT_ACTIONS.CUSTOMER_REACTIVATED,
      ACTIVITY_EVENT_ACTIONS.CUSTOMER_TAG_CHANGED,
    ],
    analysisUnits: CUSTOMER_COMPANY,
  },

  {
    id: INDICATOR_IDS.ATTENTIONS_CREATED,
    name: "Consultas / atenciones creadas",
    description: "Expedientes o atenciones abiertas (canónico + legado CS).",
    unit: "count",
    calculation: "count_matching_events",
    actions: [
      ACTIVITY_EVENT_ACTIONS.ATTENTION_CREATED,
      LEGACY_CS_ACTIONS.CASE_CREATED,
    ],
    analysisUnits: CUSTOMER_COMPANY,
  },
  {
    id: INDICATOR_IDS.ATTENTIONS_RESOLVED,
    name: "Consultas resueltas",
    description: "Atenciones o expedientes cerrados / resueltos.",
    unit: "count",
    calculation: "count_matching_events",
    actions: [
      ACTIVITY_EVENT_ACTIONS.ATTENTION_RESOLVED,
      LEGACY_CS_ACTIONS.CASE_CLOSED,
    ],
    analysisUnits: CUSTOMER_COMPANY,
  },
  {
    id: INDICATOR_IDS.ATTENTIONS_TRANSFERRED,
    name: "Atenciones transferidas / derivadas",
    description: "Transferencias canónicas y derivaciones de Customer Service.",
    unit: "count",
    calculation: "count_matching_events",
    actions: [
      ACTIVITY_EVENT_ACTIONS.ATTENTION_TRANSFERRED,
      LEGACY_CS_ACTIONS.DERIVATION_CREATED,
    ],
    analysisUnits: CUSTOMER_COMPANY,
  },
  {
    id: INDICATOR_IDS.ATTENTIONS_WORKORDERS_GENERATED,
    name: "OT generadas desde atención",
    description: "Órdenes de trabajo generadas desde atención al cliente.",
    unit: "count",
    calculation: "count_matching_events",
    actions: [
      ACTIVITY_EVENT_ACTIONS.ATTENTION_WORKORDER_GENERATED,
      LEGACY_CS_ACTIONS.OT_CREATED,
    ],
    analysisUnits: CUSTOMER_COMPANY,
  },
  {
    id: INDICATOR_IDS.RETENTIONS,
    name: "Retenciones",
    description:
      "Cambios de próximo paso a retención comercial (realizar_retencion).",
    unit: "count",
    calculation: "count_matching_events",
    actions: [LEGACY_CS_ACTIONS.NEXT_STEP_CHANGED],
    metadataEquals: { new_next_step: "realizar_retencion" },
    analysisUnits: CUSTOMER_COMPANY,
  },

  {
    id: INDICATOR_IDS.REQUESTS_CREATED,
    name: "Solicitudes creadas",
    description: "Solicitudes comerciales creadas.",
    unit: "count",
    calculation: "count_matching_events",
    actions: [ACTIVITY_EVENT_ACTIONS.REQUEST_CREATED],
    analysisUnits: CUSTOMER_COMPANY,
  },
  {
    id: INDICATOR_IDS.REQUESTS_RESOLVED,
    name: "Solicitudes resueltas",
    description: "Solicitudes comerciales resueltas.",
    unit: "count",
    calculation: "count_matching_events",
    actions: [ACTIVITY_EVENT_ACTIONS.REQUEST_RESOLVED],
    analysisUnits: CUSTOMER_COMPANY,
  },
  {
    id: INDICATOR_IDS.COMMERCIAL_ACTIVITIES,
    name: "Actividades comerciales",
    description: "Alta, edición, baja o cierre de actividades comerciales.",
    unit: "count",
    calculation: "count_matching_events",
    actions: [
      ACTIVITY_EVENT_ACTIONS.COMMERCIAL_ACTIVITY_CREATED,
      ACTIVITY_EVENT_ACTIONS.COMMERCIAL_ACTIVITY_UPDATED,
      ACTIVITY_EVENT_ACTIONS.COMMERCIAL_ACTIVITY_DELETED,
      ACTIVITY_EVENT_ACTIONS.COMMERCIAL_ACTIVITY_COMPLETED,
    ],
    analysisUnits: EMPLOYEE_COMPANY,
  },
  {
    id: INDICATOR_IDS.COMMERCIAL_COMPLETED,
    name: "Ventas realizadas",
    description: "Actividades comerciales completadas.",
    unit: "count",
    calculation: "count_matching_events",
    actions: [ACTIVITY_EVENT_ACTIONS.COMMERCIAL_ACTIVITY_COMPLETED],
    analysisUnits: EMPLOYEE_COMPANY,
  },

  {
    id: INDICATOR_IDS.WORKORDERS_CREATED,
    name: "OT creadas",
    description: "Órdenes de trabajo creadas.",
    unit: "count",
    calculation: "count_matching_events",
    actions: [ACTIVITY_EVENT_ACTIONS.WORKORDER_CREATED],
    analysisUnits: EMPLOYEE_CREW_COMPANY,
  },
  {
    id: INDICATOR_IDS.WORKORDERS_ASSIGNED,
    name: "OT asignadas",
    description: "Órdenes de trabajo asignadas a cuadrilla.",
    unit: "count",
    calculation: "count_matching_events",
    actions: [ACTIVITY_EVENT_ACTIONS.WORKORDER_ASSIGNED],
    analysisUnits: EMPLOYEE_CREW_COMPANY,
  },
  {
    id: INDICATOR_IDS.WORKORDERS_STARTED,
    name: "OT iniciadas",
    description: "Órdenes de trabajo iniciadas.",
    unit: "count",
    calculation: "count_matching_events",
    actions: [ACTIVITY_EVENT_ACTIONS.WORKORDER_STARTED],
    analysisUnits: EMPLOYEE_CREW_COMPANY,
  },
  {
    id: INDICATOR_IDS.WORKORDERS_FINISHED,
    name: "OT finalizadas",
    description: "Órdenes de trabajo finalizadas.",
    unit: "count",
    calculation: "count_matching_events",
    actions: [ACTIVITY_EVENT_ACTIONS.WORKORDER_FINISHED],
    analysisUnits: EMPLOYEE_CREW_COMPANY,
  },
  {
    id: INDICATOR_IDS.WORKORDERS_RESCHEDULED,
    name: "OT reprogramadas",
    description: "Órdenes de trabajo reprogramadas.",
    unit: "count",
    calculation: "count_matching_events",
    actions: [ACTIVITY_EVENT_ACTIONS.WORKORDER_RESCHEDULED],
    analysisUnits: EMPLOYEE_CREW_COMPANY,
  },
  {
    id: INDICATOR_IDS.WORKORDERS_CANCELLED,
    name: "OT canceladas",
    description: "Órdenes de trabajo canceladas.",
    unit: "count",
    calculation: "count_matching_events",
    actions: [ACTIVITY_EVENT_ACTIONS.WORKORDER_CANCELLED],
    analysisUnits: EMPLOYEE_CREW_COMPANY,
  },

  {
    id: INDICATOR_IDS.PROJECTS_CREATED,
    name: "Obras creadas",
    description: "Obras dadas de alta.",
    unit: "count",
    calculation: "count_matching_events",
    actions: [ACTIVITY_EVENT_ACTIONS.PROJECT_CREATED],
    analysisUnits: PROJECT_COMPANY,
  },
  {
    id: INDICATOR_IDS.PROJECTS_UPDATED,
    name: "Obras modificadas",
    description: "Cambios de estado, datos o supervisor de obras.",
    unit: "count",
    calculation: "count_matching_events",
    actions: [
      ACTIVITY_EVENT_ACTIONS.PROJECT_UPDATED,
      ACTIVITY_EVENT_ACTIONS.PROJECT_STARTED,
      ACTIVITY_EVENT_ACTIONS.PROJECT_PAUSED,
      ACTIVITY_EVENT_ACTIONS.PROJECT_FINISHED,
      ACTIVITY_EVENT_ACTIONS.PROJECT_SUPERVISOR_CHANGED,
    ],
    analysisUnits: PROJECT_COMPANY,
  },
  {
    id: INDICATOR_IDS.PROJECTS_STARTED,
    name: "Obras iniciadas",
    description: "Obras que iniciaron ejecución.",
    unit: "count",
    calculation: "count_matching_events",
    actions: [ACTIVITY_EVENT_ACTIONS.PROJECT_STARTED],
    analysisUnits: PROJECT_COMPANY,
  },
  {
    id: INDICATOR_IDS.PROJECTS_FINISHED,
    name: "Obras finalizadas",
    description: "Obras finalizadas.",
    unit: "count",
    calculation: "count_matching_events",
    actions: [ACTIVITY_EVENT_ACTIONS.PROJECT_FINISHED],
    analysisUnits: PROJECT_COMPANY,
  },

  {
    id: INDICATOR_IDS.SETTINGS_UPDATED,
    name: "Configuraciones",
    description: "Cambios de catálogos / configuración.",
    unit: "count",
    calculation: "count_matching_events",
    actions: [
      ACTIVITY_EVENT_ACTIONS.CATALOG_CREATED,
      ACTIVITY_EVENT_ACTIONS.CATALOG_UPDATED,
      ACTIVITY_EVENT_ACTIONS.CATALOG_DELETED,
    ],
    analysisUnits: ["company", "employee"],
  },

  // --- Transitional buckets (module-based; modules are canonicalized) ---
  {
    id: INDICATOR_IDS.BUCKET_CUSTOMERS,
    name: "Actividad de clientes (bucket)",
    description: "Eventos del módulo customers (transicional).",
    unit: "count",
    calculation: "count_matching_events",
    modules: ["customers"],
    analysisUnits: ALL_UNITS,
  },
  {
    id: INDICATOR_IDS.BUCKET_REQUESTS,
    name: "Actividad de solicitudes (bucket)",
    description: "Eventos del módulo requests (transicional).",
    unit: "count",
    calculation: "count_matching_events",
    modules: ["requests"],
    analysisUnits: ALL_UNITS,
  },
  {
    id: INDICATOR_IDS.BUCKET_WORK_ORDERS,
    name: "Actividad de OT / planificación (bucket)",
    description: "Eventos de tasks y planning (transicional).",
    unit: "count",
    calculation: "count_matching_events",
    modules: ["tasks", "planning"],
    analysisUnits: ALL_UNITS,
  },
  {
    id: INDICATOR_IDS.BUCKET_ATTENTIONS,
    name: "Actividad de atención (bucket)",
    description:
      "Eventos del módulo atencion (incluye alias customer_service).",
    unit: "count",
    calculation: "count_matching_events",
    modules: ["atencion"],
    analysisUnits: ALL_UNITS,
  },
  {
    id: INDICATOR_IDS.BUCKET_COMMERCIAL,
    name: "Actividad comercial (bucket)",
    description: "Eventos del módulo commercial (incluye alias sales).",
    unit: "count",
    calculation: "count_matching_events",
    modules: ["commercial"],
    analysisUnits: ALL_UNITS,
  },
  {
    id: INDICATOR_IDS.BUCKET_PROJECTS,
    name: "Actividad de obras (bucket)",
    description: "Eventos del módulo projects (transicional).",
    unit: "count",
    calculation: "count_matching_events",
    modules: ["projects"],
    analysisUnits: ALL_UNITS,
  },
  {
    id: INDICATOR_IDS.BUCKET_SETTINGS,
    name: "Actividad de configuración (bucket)",
    description: "Eventos del módulo settings (transicional).",
    unit: "count",
    calculation: "count_matching_events",
    modules: ["settings"],
    analysisUnits: ALL_UNITS,
  },
] as const

const CATALOG_BY_ID = new Map(
  INDICATOR_CATALOG.map((definition) => [definition.id, definition])
)

export function getIndicatorDefinition(
  id: string
): IndicatorDefinition | undefined {
  return CATALOG_BY_ID.get(id)
}

export function listIndicatorDefinitions(): readonly IndicatorDefinition[] {
  return INDICATOR_CATALOG
}

/** Indicator ids used by Workforce / Ops Intelligence module counters. */
export const WORKFORCE_BUCKET_INDICATOR_IDS = [
  INDICATOR_IDS.BUCKET_CUSTOMERS,
  INDICATOR_IDS.BUCKET_REQUESTS,
  INDICATOR_IDS.BUCKET_WORK_ORDERS,
  INDICATOR_IDS.BUCKET_ATTENTIONS,
  INDICATOR_IDS.BUCKET_COMMERCIAL,
  INDICATOR_IDS.BUCKET_PROJECTS,
  INDICATOR_IDS.BUCKET_SETTINGS,
] as const

/** Indicator ids used by Employee Daily Report production counters. */
export const EMPLOYEE_DAILY_INDICATOR_IDS = [
  INDICATOR_IDS.CUSTOMERS_CREATED,
  INDICATOR_IDS.CUSTOMERS_UPDATED,
  INDICATOR_IDS.REQUESTS_CREATED,
  INDICATOR_IDS.REQUESTS_RESOLVED,
  INDICATOR_IDS.WORKORDERS_CREATED,
  INDICATOR_IDS.WORKORDERS_ASSIGNED,
  INDICATOR_IDS.WORKORDERS_STARTED,
  INDICATOR_IDS.WORKORDERS_FINISHED,
  INDICATOR_IDS.ATTENTIONS_CREATED,
  INDICATOR_IDS.ATTENTIONS_RESOLVED,
  INDICATOR_IDS.COMMERCIAL_ACTIVITIES,
  INDICATOR_IDS.PROJECTS_UPDATED,
  INDICATOR_IDS.SETTINGS_UPDATED,
  INDICATOR_IDS.DISTINCT_MODULES,
  INDICATOR_IDS.FIRST_EVENT_AT,
  INDICATOR_IDS.LAST_EVENT_AT,
  INDICATOR_IDS.ACTIVE_TIME_MS,
  INDICATOR_IDS.EVENTS_TOTAL,
] as const

/** Indicators consumed by Sala de Situación / Executive Brief. */
export const EXECUTIVE_BRIEF_INDICATOR_IDS = [
  INDICATOR_IDS.EMPLOYEES_ACTIVE,
  INDICATOR_IDS.CREWS_ACTIVE,
  INDICATOR_IDS.PROJECTS_ACTIVE,
  INDICATOR_IDS.WORKORDERS_STARTED,
  INDICATOR_IDS.WORKORDERS_FINISHED,
  INDICATOR_IDS.WORKORDERS_CREATED,
  INDICATOR_IDS.WORKORDERS_ASSIGNED,
  INDICATOR_IDS.WORKORDERS_RESCHEDULED,
  INDICATOR_IDS.WORKORDERS_CANCELLED,
  INDICATOR_IDS.ATTENTIONS_CREATED,
  INDICATOR_IDS.ATTENTIONS_RESOLVED,
  INDICATOR_IDS.ATTENTIONS_TRANSFERRED,
  INDICATOR_IDS.ATTENTIONS_WORKORDERS_GENERATED,
  INDICATOR_IDS.RETENTIONS,
  INDICATOR_IDS.COMMERCIAL_COMPLETED,
  INDICATOR_IDS.COMMERCIAL_ACTIVITIES,
  INDICATOR_IDS.REQUESTS_CREATED,
  INDICATOR_IDS.REQUESTS_RESOLVED,
  INDICATOR_IDS.CUSTOMERS_CREATED,
  INDICATOR_IDS.CUSTOMERS_UPDATED,
  INDICATOR_IDS.PROJECTS_CREATED,
  INDICATOR_IDS.PROJECTS_STARTED,
  INDICATOR_IDS.PROJECTS_FINISHED,
  INDICATOR_IDS.PROJECTS_UPDATED,
  INDICATOR_IDS.FIRST_EVENT_AT,
  INDICATOR_IDS.LAST_EVENT_AT,
  INDICATOR_IDS.ACTIVE_TIME_MS,
  INDICATOR_IDS.EVENTS_TOTAL,
] as const
