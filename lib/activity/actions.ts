/**
 * Stable Activity Engine action identifiers.
 * Format: domain.verb — never free UI text.
 */
export const ACTIVITY_EVENT_ACTIONS = {
  // RRHH
  EMPLOYEE_CREATED: "employee.created",
  EMPLOYEE_UPDATED: "employee.updated",
  EMPLOYEE_DELETED: "employee.deleted",
  EMPLOYEE_ROLE_CHANGED: "employee.role_changed",
  EMPLOYEE_SUPERVISOR_CHANGED: "employee.supervisor_changed",
  EMPLOYEE_CREW_CHANGED: "employee.crew_changed",
  EMPLOYEE_AVAILABILITY_CHANGED: "employee.availability_changed",
  EMPLOYEE_REACTIVATED: "employee.reactivated",

  // Clientes
  CUSTOMER_CREATED: "customer.created",
  CUSTOMER_UPDATED: "customer.updated",
  CUSTOMER_ARCHIVED: "customer.archived",
  CUSTOMER_REACTIVATED: "customer.reactivated",
  CUSTOMER_TAG_CHANGED: "customer.tag_changed",

  // Solicitudes
  REQUEST_CREATED: "request.created",
  REQUEST_UPDATED: "request.updated",
  REQUEST_PRIORITY_CHANGED: "request.priority_changed",
  REQUEST_STATUS_CHANGED: "request.status_changed",
  REQUEST_RESOLVED: "request.resolved",
  REQUEST_CANCELLED: "request.cancelled",
  REQUEST_WORKORDER_GENERATED: "request.workorder_generated",

  // Actividades comerciales
  COMMERCIAL_ACTIVITY_CREATED: "commercial_activity.created",
  COMMERCIAL_ACTIVITY_UPDATED: "commercial_activity.updated",
  COMMERCIAL_ACTIVITY_DELETED: "commercial_activity.deleted",
  COMMERCIAL_ACTIVITY_COMPLETED: "commercial_activity.completed",

  // Atención al cliente
  ATTENTION_CREATED: "attention.created",
  ATTENTION_UPDATED: "attention.updated",
  ATTENTION_STATUS_CHANGED: "attention.status_changed",
  ATTENTION_TRANSFERRED: "attention.transferred",
  ATTENTION_RESOLVED: "attention.resolved",
  ATTENTION_WORKORDER_GENERATED: "attention.workorder_generated",

  // Obras
  PROJECT_CREATED: "project.created",
  PROJECT_UPDATED: "project.updated",
  PROJECT_STARTED: "project.started",
  PROJECT_PAUSED: "project.paused",
  PROJECT_FINISHED: "project.finished",
  PROJECT_SUPERVISOR_CHANGED: "project.supervisor_changed",

  // OT / work orders
  WORKORDER_CREATED: "workorder.created",
  WORKORDER_UPDATED: "workorder.updated",
  WORKORDER_SCHEDULED: "workorder.scheduled",
  WORKORDER_ASSIGNED: "workorder.assigned",
  WORKORDER_RESCHEDULED: "workorder.rescheduled",
  WORKORDER_CREW_CHANGED: "workorder.crew_changed",
  WORKORDER_PRIORITY_CHANGED: "workorder.priority_changed",
  WORKORDER_STARTED: "workorder.started",
  WORKORDER_PAUSED: "workorder.paused",
  WORKORDER_RESUMED: "workorder.resumed",
  WORKORDER_FINISHED: "workorder.finished",
  WORKORDER_CANCELLED: "workorder.cancelled",

  // Planificación
  PLANNING_ORDER_CHANGED: "planning.order_changed",
  PLANNING_DATE_CHANGED: "planning.date_changed",
  PLANNING_SHIFT_CHANGED: "planning.shift_changed",
  PLANNING_DURATION_CHANGED: "planning.duration_changed",
  PLANNING_ASSIGNMENT_CHANGED: "planning.assignment_changed",

  // Cuadrillas
  CREW_CREATED: "crew.created",
  CREW_UPDATED: "crew.updated",
  CREW_DELETED: "crew.deleted",
  CREW_MEMBER_ASSIGNED: "crew.member_assigned",
  CREW_SUPERVISOR_CHANGED: "crew.supervisor_changed",

  // Configuración / catálogos
  CATALOG_CREATED: "catalog.created",
  CATALOG_UPDATED: "catalog.updated",
  CATALOG_DELETED: "catalog.deleted",
} as const

export type ActivityEventAction =
  (typeof ACTIVITY_EVENT_ACTIONS)[keyof typeof ACTIVITY_EVENT_ACTIONS]

export const ACTIVITY_EVENT_TITLES: Record<ActivityEventAction, string> = {
  [ACTIVITY_EVENT_ACTIONS.EMPLOYEE_CREATED]: "Empleado creado",
  [ACTIVITY_EVENT_ACTIONS.EMPLOYEE_UPDATED]: "Empleado actualizado",
  [ACTIVITY_EVENT_ACTIONS.EMPLOYEE_DELETED]: "Empleado eliminado",
  [ACTIVITY_EVENT_ACTIONS.EMPLOYEE_ROLE_CHANGED]: "Rol de empleado cambiado",
  [ACTIVITY_EVENT_ACTIONS.EMPLOYEE_SUPERVISOR_CHANGED]:
    "Supervisor de empleado cambiado",
  [ACTIVITY_EVENT_ACTIONS.EMPLOYEE_CREW_CHANGED]: "Cuadrilla de empleado cambiada",
  [ACTIVITY_EVENT_ACTIONS.EMPLOYEE_AVAILABILITY_CHANGED]:
    "Disponibilidad de empleado cambiada",
  [ACTIVITY_EVENT_ACTIONS.EMPLOYEE_REACTIVATED]: "Empleado reactivado",

  [ACTIVITY_EVENT_ACTIONS.CUSTOMER_CREATED]: "Cliente creado",
  [ACTIVITY_EVENT_ACTIONS.CUSTOMER_UPDATED]: "Cliente actualizado",
  [ACTIVITY_EVENT_ACTIONS.CUSTOMER_ARCHIVED]: "Cliente archivado",
  [ACTIVITY_EVENT_ACTIONS.CUSTOMER_REACTIVATED]: "Cliente reactivado",
  [ACTIVITY_EVENT_ACTIONS.CUSTOMER_TAG_CHANGED]: "Etiqueta de cliente cambiada",

  [ACTIVITY_EVENT_ACTIONS.REQUEST_CREATED]: "Solicitud creada",
  [ACTIVITY_EVENT_ACTIONS.REQUEST_UPDATED]: "Solicitud actualizada",
  [ACTIVITY_EVENT_ACTIONS.REQUEST_PRIORITY_CHANGED]:
    "Prioridad de solicitud cambiada",
  [ACTIVITY_EVENT_ACTIONS.REQUEST_STATUS_CHANGED]: "Estado de solicitud cambiado",
  [ACTIVITY_EVENT_ACTIONS.REQUEST_RESOLVED]: "Solicitud resuelta",
  [ACTIVITY_EVENT_ACTIONS.REQUEST_CANCELLED]: "Solicitud cancelada",
  [ACTIVITY_EVENT_ACTIONS.REQUEST_WORKORDER_GENERATED]:
    "OT generada desde solicitud",

  [ACTIVITY_EVENT_ACTIONS.COMMERCIAL_ACTIVITY_CREATED]: "Actividad creada",
  [ACTIVITY_EVENT_ACTIONS.COMMERCIAL_ACTIVITY_UPDATED]: "Actividad editada",
  [ACTIVITY_EVENT_ACTIONS.COMMERCIAL_ACTIVITY_DELETED]: "Actividad eliminada",
  [ACTIVITY_EVENT_ACTIONS.COMMERCIAL_ACTIVITY_COMPLETED]: "Actividad completada",

  [ACTIVITY_EVENT_ACTIONS.ATTENTION_CREATED]: "Atención creada",
  [ACTIVITY_EVENT_ACTIONS.ATTENTION_UPDATED]: "Atención actualizada",
  [ACTIVITY_EVENT_ACTIONS.ATTENTION_STATUS_CHANGED]: "Estado de atención cambiado",
  [ACTIVITY_EVENT_ACTIONS.ATTENTION_TRANSFERRED]: "Atención derivada",
  [ACTIVITY_EVENT_ACTIONS.ATTENTION_RESOLVED]: "Atención resuelta",
  [ACTIVITY_EVENT_ACTIONS.ATTENTION_WORKORDER_GENERATED]:
    "OT generada desde atención",

  [ACTIVITY_EVENT_ACTIONS.PROJECT_CREATED]: "Obra creada",
  [ACTIVITY_EVENT_ACTIONS.PROJECT_UPDATED]: "Obra editada",
  [ACTIVITY_EVENT_ACTIONS.PROJECT_STARTED]: "Obra iniciada",
  [ACTIVITY_EVENT_ACTIONS.PROJECT_PAUSED]: "Obra pausada",
  [ACTIVITY_EVENT_ACTIONS.PROJECT_FINISHED]: "Obra finalizada",
  [ACTIVITY_EVENT_ACTIONS.PROJECT_SUPERVISOR_CHANGED]:
    "Supervisor de obra cambiado",

  [ACTIVITY_EVENT_ACTIONS.WORKORDER_CREATED]: "OT creada",
  [ACTIVITY_EVENT_ACTIONS.WORKORDER_UPDATED]: "OT editada",
  [ACTIVITY_EVENT_ACTIONS.WORKORDER_SCHEDULED]: "OT programada",
  [ACTIVITY_EVENT_ACTIONS.WORKORDER_ASSIGNED]: "OT asignada",
  [ACTIVITY_EVENT_ACTIONS.WORKORDER_RESCHEDULED]: "OT reprogramada",
  [ACTIVITY_EVENT_ACTIONS.WORKORDER_CREW_CHANGED]: "Cuadrilla de OT cambiada",
  [ACTIVITY_EVENT_ACTIONS.WORKORDER_PRIORITY_CHANGED]: "Prioridad de OT cambiada",
  [ACTIVITY_EVENT_ACTIONS.WORKORDER_STARTED]: "OT iniciada",
  [ACTIVITY_EVENT_ACTIONS.WORKORDER_PAUSED]: "OT pausada",
  [ACTIVITY_EVENT_ACTIONS.WORKORDER_RESUMED]: "OT reanudada",
  [ACTIVITY_EVENT_ACTIONS.WORKORDER_FINISHED]: "OT finalizada",
  [ACTIVITY_EVENT_ACTIONS.WORKORDER_CANCELLED]: "OT cancelada",

  [ACTIVITY_EVENT_ACTIONS.PLANNING_ORDER_CHANGED]: "Orden de planificación cambiado",
  [ACTIVITY_EVENT_ACTIONS.PLANNING_DATE_CHANGED]: "Fecha de planificación cambiada",
  [ACTIVITY_EVENT_ACTIONS.PLANNING_SHIFT_CHANGED]: "Turno de planificación cambiado",
  [ACTIVITY_EVENT_ACTIONS.PLANNING_DURATION_CHANGED]:
    "Duración de planificación cambiada",
  [ACTIVITY_EVENT_ACTIONS.PLANNING_ASSIGNMENT_CHANGED]:
    "Asignación de planificación cambiada",

  [ACTIVITY_EVENT_ACTIONS.CREW_CREATED]: "Cuadrilla creada",
  [ACTIVITY_EVENT_ACTIONS.CREW_UPDATED]: "Cuadrilla editada",
  [ACTIVITY_EVENT_ACTIONS.CREW_DELETED]: "Cuadrilla eliminada",
  [ACTIVITY_EVENT_ACTIONS.CREW_MEMBER_ASSIGNED]: "Integrante asignado a cuadrilla",
  [ACTIVITY_EVENT_ACTIONS.CREW_SUPERVISOR_CHANGED]:
    "Supervisor de cuadrilla cambiado",

  [ACTIVITY_EVENT_ACTIONS.CATALOG_CREATED]: "Catálogo creado",
  [ACTIVITY_EVENT_ACTIONS.CATALOG_UPDATED]: "Catálogo editado",
  [ACTIVITY_EVENT_ACTIONS.CATALOG_DELETED]: "Catálogo eliminado",
}
