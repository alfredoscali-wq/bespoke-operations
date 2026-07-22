import {
  ACTIVITY_ACTIONS,
  ACTIVITY_ENTITY_TYPES,
  ACTIVITY_MODULES,
  ACTIVITY_SEVERITIES,
  type ActivityAction,
  type ActivityActionDefinition,
  type ActivitySeverity,
} from "@/lib/activity/types"

const {
  TASKS,
  PROJECTS,
  PLANNING,
  ATENCION,
  CUSTOMERS,
  RRHH,
  CREWS,
  USERS,
  INCIDENTS,
  MOBILE,
  DEVICES,
  EVIDENCE,
  MATERIALS,
  REPORTS,
  SETTINGS,
  SYSTEM,
} = ACTIVITY_MODULES

const {
  TASK,
  PROJECT,
  PLANNING_DAY,
  CUSTOMER_ATENCION,
  CUSTOMER,
  EMPLOYEE,
  CREW,
  USER,
  SESSION,
  INCIDENT,
  MOBILE_DEVICE,
  WORK_TEAM_SHIFT,
  EVIDENCE: EVIDENCE_ENTITY,
  MATERIAL,
  SETTING,
  REPORT_RUN,
  IMPORT_BATCH,
  AUDIT_EXPORT,
} = ACTIVITY_ENTITY_TYPES

const { INFO, WARNING, CRITICAL } = ACTIVITY_SEVERITIES

function def(
  module: ActivityActionDefinition["module"],
  entityType: ActivityActionDefinition["entityType"],
  severity: ActivityActionDefinition["severity"],
  label: string
): ActivityActionDefinition {
  return { module, entityType, severity, label }
}

/** Single source of truth for official Activity codes. */
export const ACTIVITY_ACTION_DEFINITIONS: Record<
  ActivityAction,
  ActivityActionDefinition
> = {
  [ACTIVITY_ACTIONS.TASK_CREATE]: def(TASKS, TASK, INFO, "Crear OT"),
  [ACTIVITY_ACTIONS.TASK_UPDATE]: def(TASKS, TASK, INFO, "Editar OT"),
  [ACTIVITY_ACTIONS.TASK_ASSIGN_CREW]: def(
    TASKS,
    TASK,
    WARNING,
    "Asignar / cambiar cuadrilla"
  ),
  [ACTIVITY_ACTIONS.TASK_UNASSIGN_CREW]: def(
    TASKS,
    TASK,
    WARNING,
    "Desasignar cuadrilla"
  ),
  [ACTIVITY_ACTIONS.TASK_RESCHEDULE]: def(TASKS, TASK, WARNING, "Reprogramar OT"),
  [ACTIVITY_ACTIONS.TASK_PRIORITY_CHANGE]: def(
    TASKS,
    TASK,
    WARNING,
    "Cambiar prioridad"
  ),
  [ACTIVITY_ACTIONS.TASK_DURATION_CHANGE]: def(
    TASKS,
    TASK,
    INFO,
    "Cambiar duración"
  ),
  [ACTIVITY_ACTIONS.TASK_MATERIALS_CHANGE]: def(
    TASKS,
    TASK,
    INFO,
    "Cambiar materiales de OT"
  ),
  [ACTIVITY_ACTIONS.TASK_START]: def(TASKS, TASK, INFO, "Iniciar ejecución"),
  [ACTIVITY_ACTIONS.TASK_SUBMIT_FOR_APPROVAL]: def(
    TASKS,
    TASK,
    INFO,
    "Solicitar cierre"
  ),
  [ACTIVITY_ACTIONS.TASK_APPROVE]: def(TASKS, TASK, INFO, "Aprobar / finalizar OT"),
  [ACTIVITY_ACTIONS.TASK_REJECT]: def(TASKS, TASK, WARNING, "Rechazar cierre"),
  [ACTIVITY_ACTIONS.TASK_CANCEL]: def(TASKS, TASK, WARNING, "Cancelar OT"),
  [ACTIVITY_ACTIONS.TASK_MARK_OVERDUE]: def(TASKS, TASK, WARNING, "Marcar vencida"),
  [ACTIVITY_ACTIONS.TASK_DELETE]: def(TASKS, TASK, WARNING, "Eliminar OT (soft)"),
  [ACTIVITY_ACTIONS.TASK_DELETE_PERMANENT]: def(
    TASKS,
    TASK,
    CRITICAL,
    "Eliminar OT definitiva"
  ),
  [ACTIVITY_ACTIONS.TASK_FORCE_DELETE]: def(
    TASKS,
    TASK,
    CRITICAL,
    "Force delete OT"
  ),
  [ACTIVITY_ACTIONS.TASK_REFERENCE_PHOTO_DELETE]: def(
    TASKS,
    TASK,
    WARNING,
    "Eliminar foto referencia"
  ),
  [ACTIVITY_ACTIONS.TASK_CHECKLIST_COMPLETE]: def(
    TASKS,
    TASK,
    INFO,
    "Completar checklist"
  ),
  [ACTIVITY_ACTIONS.TASK_CUSTOMER_SIGN]: def(TASKS, TASK, INFO, "Firma cliente"),

  [ACTIVITY_ACTIONS.PROJECT_CREATE]: def(PROJECTS, PROJECT, INFO, "Crear obra"),
  [ACTIVITY_ACTIONS.PROJECT_UPDATE]: def(PROJECTS, PROJECT, INFO, "Editar obra"),
  [ACTIVITY_ACTIONS.PROJECT_START]: def(PROJECTS, PROJECT, WARNING, "Iniciar obra"),
  [ACTIVITY_ACTIONS.PROJECT_FINISH]: def(
    PROJECTS,
    PROJECT,
    WARNING,
    "Finalizar obra"
  ),
  [ACTIVITY_ACTIONS.PROJECT_CANCEL]: def(PROJECTS, PROJECT, WARNING, "Cancelar obra"),
  [ACTIVITY_ACTIONS.PROJECT_ARCHIVE]: def(PROJECTS, PROJECT, WARNING, "Archivar obra"),
  [ACTIVITY_ACTIONS.PROJECT_DELETE_PERMANENT]: def(
    PROJECTS,
    PROJECT,
    CRITICAL,
    "Eliminar obra definitiva"
  ),
  [ACTIVITY_ACTIONS.PROJECT_FORCE_DELETE]: def(
    PROJECTS,
    PROJECT,
    CRITICAL,
    "Force delete obra"
  ),

  [ACTIVITY_ACTIONS.PLANNING_CONFIRM]: def(
    PLANNING,
    PLANNING_DAY,
    INFO,
    "Confirmar planificación"
  ),
  [ACTIVITY_ACTIONS.PLANNING_ORDER_CHANGE]: def(
    PLANNING,
    TASK,
    INFO,
    "Cambiar orden de ejecución"
  ),
  [ACTIVITY_ACTIONS.PLANNING_CREW_CHANGE]: def(
    PLANNING,
    TASK,
    WARNING,
    "Cambiar cuadrilla en plan"
  ),
  [ACTIVITY_ACTIONS.PLANNING_RETURN]: def(
    PLANNING,
    TASK,
    WARNING,
    "Devolver a planificación"
  ),

  [ACTIVITY_ACTIONS.ATENCION_CREATE]: def(
    ATENCION,
    CUSTOMER_ATENCION,
    INFO,
    "Crear consulta"
  ),
  [ACTIVITY_ACTIONS.ATENCION_START_MANAGEMENT]: def(
    ATENCION,
    CUSTOMER_ATENCION,
    INFO,
    "Iniciar gestión"
  ),
  [ACTIVITY_ACTIONS.ATENCION_REGISTER_INTERACTION]: def(
    ATENCION,
    CUSTOMER_ATENCION,
    INFO,
    "Registrar interacción"
  ),
  [ACTIVITY_ACTIONS.ATENCION_DEFER]: def(
    ATENCION,
    CUSTOMER_ATENCION,
    INFO,
    "Diferir / esperar"
  ),
  [ACTIVITY_ACTIONS.ATENCION_TRANSFER]: def(
    ATENCION,
    CUSTOMER_ATENCION,
    WARNING,
    "Derivar"
  ),
  [ACTIVITY_ACTIONS.ATENCION_RESOLVE]: def(
    ATENCION,
    CUSTOMER_ATENCION,
    INFO,
    "Resolver consulta"
  ),
  [ACTIVITY_ACTIONS.ATENCION_LINK_TASK]: def(
    ATENCION,
    CUSTOMER_ATENCION,
    WARNING,
    "Vincular / generar OT"
  ),
  [ACTIVITY_ACTIONS.ATENCION_RETENTION_UPDATE]: def(
    ATENCION,
    CUSTOMER_ATENCION,
    INFO,
    "Actualizar retención"
  ),
  [ACTIVITY_ACTIONS.ATENCION_MOROSO_UPDATE]: def(
    ATENCION,
    CUSTOMER_ATENCION,
    INFO,
    "Actualizar proceso moroso"
  ),
  [ACTIVITY_ACTIONS.ATENCION_CLOSE]: def(
    ATENCION,
    CUSTOMER_ATENCION,
    INFO,
    "Cerrar consulta"
  ),
  [ACTIVITY_ACTIONS.ATENCION_DELETE_PERMANENT]: def(
    ATENCION,
    CUSTOMER_ATENCION,
    CRITICAL,
    "Eliminar consulta"
  ),
  [ACTIVITY_ACTIONS.ATENCION_MANAGEMENT_RELEASED]: def(
    ATENCION,
    CUSTOMER_ATENCION,
    WARNING,
    "Liberar gestión por inactividad"
  ),

  [ACTIVITY_ACTIONS.CUSTOMER_CREATE]: def(CUSTOMERS, CUSTOMER, INFO, "Crear cliente"),
  [ACTIVITY_ACTIONS.CUSTOMER_UPDATE]: def(CUSTOMERS, CUSTOMER, INFO, "Editar cliente"),
  [ACTIVITY_ACTIONS.CUSTOMER_ADDRESS_CHANGE]: def(
    CUSTOMERS,
    CUSTOMER,
    WARNING,
    "Cambiar domicilio"
  ),
  [ACTIVITY_ACTIONS.CUSTOMER_PLAN_CHANGE]: def(
    CUSTOMERS,
    CUSTOMER,
    WARNING,
    "Cambiar plan"
  ),
  [ACTIVITY_ACTIONS.CUSTOMER_TECHNOLOGY_CHANGE]: def(
    CUSTOMERS,
    CUSTOMER,
    WARNING,
    "Cambiar tecnología"
  ),
  [ACTIVITY_ACTIONS.CUSTOMER_VALIDATE]: def(
    CUSTOMERS,
    CUSTOMER,
    WARNING,
    "Validar cliente"
  ),
  [ACTIVITY_ACTIONS.CUSTOMER_ACTIVATE]: def(
    CUSTOMERS,
    CUSTOMER,
    INFO,
    "Activar cliente"
  ),
  [ACTIVITY_ACTIONS.CUSTOMER_ARCHIVE]: def(
    CUSTOMERS,
    CUSTOMER,
    WARNING,
    "Archivar cliente"
  ),
  [ACTIVITY_ACTIONS.CUSTOMER_DELETE]: def(
    CUSTOMERS,
    CUSTOMER,
    WARNING,
    "Eliminar cliente (soft)"
  ),
  [ACTIVITY_ACTIONS.CUSTOMER_DELETE_PERMANENT]: def(
    CUSTOMERS,
    CUSTOMER,
    CRITICAL,
    "Eliminar cliente definitiva"
  ),
  [ACTIVITY_ACTIONS.CUSTOMER_IMPORT]: def(
    CUSTOMERS,
    IMPORT_BATCH,
    WARNING,
    "Importar clientes"
  ),

  [ACTIVITY_ACTIONS.EMPLOYEE_CREATE]: def(RRHH, EMPLOYEE, INFO, "Crear empleado"),
  [ACTIVITY_ACTIONS.EMPLOYEE_UPDATE]: def(RRHH, EMPLOYEE, INFO, "Editar empleado"),
  [ACTIVITY_ACTIONS.EMPLOYEE_DEACTIVATE]: def(
    RRHH,
    EMPLOYEE,
    WARNING,
    "Desactivar empleado"
  ),
  [ACTIVITY_ACTIONS.EMPLOYEE_REACTIVATE]: def(
    RRHH,
    EMPLOYEE,
    WARNING,
    "Reactivar empleado"
  ),
  [ACTIVITY_ACTIONS.EMPLOYEE_AVAILABILITY_CHANGE]: def(
    RRHH,
    EMPLOYEE,
    WARNING,
    "Cambiar disponibilidad"
  ),

  [ACTIVITY_ACTIONS.CREW_CREATE]: def(CREWS, CREW, INFO, "Crear cuadrilla"),
  [ACTIVITY_ACTIONS.CREW_UPDATE]: def(CREWS, CREW, INFO, "Editar cuadrilla"),
  [ACTIVITY_ACTIONS.CREW_ARCHIVE]: def(CREWS, CREW, WARNING, "Archivar cuadrilla"),
  [ACTIVITY_ACTIONS.CREW_MEMBER_ADD]: def(CREWS, CREW, INFO, "Agregar miembro"),
  [ACTIVITY_ACTIONS.CREW_MEMBER_REMOVE]: def(
    CREWS,
    CREW,
    WARNING,
    "Quitar miembro"
  ),

  [ACTIVITY_ACTIONS.USER_LOGIN]: def(USERS, SESSION, INFO, "Inicio de sesión"),
  [ACTIVITY_ACTIONS.USER_LOGOUT]: def(USERS, SESSION, INFO, "Cierre de sesión"),
  [ACTIVITY_ACTIONS.USER_CREATE]: def(USERS, USER, WARNING, "Crear usuario"),
  [ACTIVITY_ACTIONS.USER_PROVISION]: def(USERS, USER, WARNING, "Provisionar acceso"),
  [ACTIVITY_ACTIONS.USER_PASSWORD_RESET]: def(
    USERS,
    USER,
    WARNING,
    "Reset password"
  ),
  [ACTIVITY_ACTIONS.USER_ROLE_CHANGE]: def(USERS, USER, WARNING, "Cambiar rol"),
  [ACTIVITY_ACTIONS.USER_DEACTIVATE]: def(USERS, USER, WARNING, "Desactivar usuario"),
  [ACTIVITY_ACTIONS.USER_REACTIVATE]: def(USERS, USER, WARNING, "Reactivar usuario"),

  [ACTIVITY_ACTIONS.INCIDENT_CREATE]: def(
    INCIDENTS,
    INCIDENT,
    WARNING,
    "Crear incidencia"
  ),
  [ACTIVITY_ACTIONS.INCIDENT_SUPERVISOR_ACTION]: def(
    INCIDENTS,
    INCIDENT,
    WARNING,
    "Acción supervisor"
  ),
  [ACTIVITY_ACTIONS.INCIDENT_RESOLVE]: def(
    INCIDENTS,
    INCIDENT,
    INFO,
    "Resolver incidencia"
  ),
  [ACTIVITY_ACTIONS.INCIDENT_CLOSE]: def(INCIDENTS, INCIDENT, INFO, "Cerrar incidencia"),

  [ACTIVITY_ACTIONS.SHIFT_START]: def(MOBILE, WORK_TEAM_SHIFT, INFO, "Iniciar jornada"),
  [ACTIVITY_ACTIONS.SHIFT_FINISH]: def(
    MOBILE,
    WORK_TEAM_SHIFT,
    INFO,
    "Finalizar jornada"
  ),
  [ACTIVITY_ACTIONS.DEVICE_REGISTER]: def(
    DEVICES,
    MOBILE_DEVICE,
    INFO,
    "Registrar dispositivo"
  ),
  [ACTIVITY_ACTIONS.DEVICE_ACTIVATE]: def(
    DEVICES,
    MOBILE_DEVICE,
    WARNING,
    "Activar dispositivo"
  ),
  [ACTIVITY_ACTIONS.DEVICE_BLOCK]: def(
    DEVICES,
    MOBILE_DEVICE,
    CRITICAL,
    "Bloquear dispositivo"
  ),

  [ACTIVITY_ACTIONS.EVIDENCE_UPLOAD]: def(
    EVIDENCE,
    EVIDENCE_ENTITY,
    INFO,
    "Cargar evidencia"
  ),
  [ACTIVITY_ACTIONS.EVIDENCE_VOID]: def(
    EVIDENCE,
    EVIDENCE_ENTITY,
    WARNING,
    "Anular evidencia"
  ),
  [ACTIVITY_ACTIONS.MATERIAL_CREATE]: def(MATERIALS, MATERIAL, INFO, "Crear material"),
  [ACTIVITY_ACTIONS.MATERIAL_UPDATE]: def(MATERIALS, MATERIAL, INFO, "Editar material"),
  [ACTIVITY_ACTIONS.MATERIAL_DELETE]: def(
    MATERIALS,
    MATERIAL,
    WARNING,
    "Eliminar material"
  ),
  [ACTIVITY_ACTIONS.SETTINGS_UPDATE]: def(
    SETTINGS,
    SETTING,
    WARNING,
    "Actualizar configuración"
  ),
  [ACTIVITY_ACTIONS.REPORT_RUN]: def(REPORTS, REPORT_RUN, INFO, "Ejecutar reporte"),
  [ACTIVITY_ACTIONS.REPORT_SEND]: def(REPORTS, REPORT_RUN, INFO, "Enviar reporte"),
  [ACTIVITY_ACTIONS.REPORT_RESEND]: def(REPORTS, REPORT_RUN, INFO, "Reenviar reporte"),
  [ACTIVITY_ACTIONS.SYSTEM_AUDIT_EXPORT]: def(
    SYSTEM,
    AUDIT_EXPORT,
    INFO,
    "Exportar historial"
  ),
  [ACTIVITY_ACTIONS.FORCE_DELETE]: def(SYSTEM, TASK, CRITICAL, "Force delete genérico"),
}

export function isActivityAction(value: string): value is ActivityAction {
  return Object.prototype.hasOwnProperty.call(ACTIVITY_ACTION_DEFINITIONS, value)
}

export function resolveActivityActionDefinition(
  action: ActivityAction
): ActivityActionDefinition {
  return ACTIVITY_ACTION_DEFINITIONS[action]
}

export function resolveActivitySeverity(action: ActivityAction): ActivitySeverity {
  return ACTIVITY_ACTION_DEFINITIONS[action].severity
}

export function listActivityActions(): ActivityAction[] {
  return Object.keys(ACTIVITY_ACTION_DEFINITIONS) as ActivityAction[]
}
