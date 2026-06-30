import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_MODULES,
  AUDIT_SEVERITIES,
  type AuditAction,
  type AuditEntityType,
  type AuditModule,
  type AuditSeverity,
} from "@/lib/audit/types"

export type AuditActionDefinition = {
  module: AuditModule
  entityType: AuditEntityType
  severity: AuditSeverity
}

export const AUDIT_ACTION_DEFINITIONS: Record<AuditAction, AuditActionDefinition> =
  {
    [AUDIT_ACTIONS.CUSTOMER_CREATE]: {
      module: AUDIT_MODULES.CLIENTES,
      entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.CUSTOMER_UPDATE]: {
      module: AUDIT_MODULES.CLIENTES,
      entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.CUSTOMER_VALIDATE]: {
      module: AUDIT_MODULES.CLIENTES,
      entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
      severity: AUDIT_SEVERITIES.WARNING,
    },
    [AUDIT_ACTIONS.CUSTOMER_ACTIVATE]: {
      module: AUDIT_MODULES.CLIENTES,
      entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.CUSTOMER_ARCHIVE]: {
      module: AUDIT_MODULES.CLIENTES,
      entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
      severity: AUDIT_SEVERITIES.WARNING,
    },
    [AUDIT_ACTIONS.CUSTOMER_DELETE]: {
      module: AUDIT_MODULES.CLIENTES,
      entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
      severity: AUDIT_SEVERITIES.WARNING,
    },
    [AUDIT_ACTIONS.CUSTOMER_DELETE_PERMANENT]: {
      module: AUDIT_MODULES.CLIENTES,
      entityType: AUDIT_ENTITY_TYPES.CUSTOMER,
      severity: AUDIT_SEVERITIES.CRITICAL,
    },
    [AUDIT_ACTIONS.TASK_CREATE]: {
      module: AUDIT_MODULES.TAREAS,
      entityType: AUDIT_ENTITY_TYPES.TASK,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.TASK_UPDATE]: {
      module: AUDIT_MODULES.TAREAS,
      entityType: AUDIT_ENTITY_TYPES.TASK,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.TASK_ASSIGN_CREW]: {
      module: AUDIT_MODULES.TAREAS,
      entityType: AUDIT_ENTITY_TYPES.TASK,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.TASK_RESCHEDULE]: {
      module: AUDIT_MODULES.TAREAS,
      entityType: AUDIT_ENTITY_TYPES.TASK,
      severity: AUDIT_SEVERITIES.WARNING,
    },
    [AUDIT_ACTIONS.TASK_STATUS_VENCIDA]: {
      module: AUDIT_MODULES.TAREAS,
      entityType: AUDIT_ENTITY_TYPES.TASK,
      severity: AUDIT_SEVERITIES.WARNING,
    },
    [AUDIT_ACTIONS.TASK_STATUS_EN_CURSO]: {
      module: AUDIT_MODULES.TAREAS,
      entityType: AUDIT_ENTITY_TYPES.TASK,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.TASK_REQUEST_CLOSE]: {
      module: AUDIT_MODULES.TAREAS,
      entityType: AUDIT_ENTITY_TYPES.TASK,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.TASK_FINISH]: {
      module: AUDIT_MODULES.TAREAS,
      entityType: AUDIT_ENTITY_TYPES.TASK,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.TASK_CLOSE]: {
      module: AUDIT_MODULES.TAREAS,
      entityType: AUDIT_ENTITY_TYPES.TASK,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.TASK_DELETE]: {
      module: AUDIT_MODULES.TAREAS,
      entityType: AUDIT_ENTITY_TYPES.TASK,
      severity: AUDIT_SEVERITIES.WARNING,
    },
    [AUDIT_ACTIONS.TASK_DELETE_PERMANENT]: {
      module: AUDIT_MODULES.TAREAS,
      entityType: AUDIT_ENTITY_TYPES.TASK,
      severity: AUDIT_SEVERITIES.CRITICAL,
    },
    [AUDIT_ACTIONS.PLANNING_CONFIRMED]: {
      module: AUDIT_MODULES.TAREAS,
      entityType: AUDIT_ENTITY_TYPES.TASK,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.PROJECT_CREATE]: {
      module: AUDIT_MODULES.OBRAS,
      entityType: AUDIT_ENTITY_TYPES.PROJECT,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.PROJECT_UPDATE]: {
      module: AUDIT_MODULES.OBRAS,
      entityType: AUDIT_ENTITY_TYPES.PROJECT,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.PROJECT_STATUS_CHANGE]: {
      module: AUDIT_MODULES.OBRAS,
      entityType: AUDIT_ENTITY_TYPES.PROJECT,
      severity: AUDIT_SEVERITIES.WARNING,
    },
    [AUDIT_ACTIONS.PROJECT_ARCHIVE]: {
      module: AUDIT_MODULES.OBRAS,
      entityType: AUDIT_ENTITY_TYPES.PROJECT,
      severity: AUDIT_SEVERITIES.WARNING,
    },
    [AUDIT_ACTIONS.PROJECT_DELETE_PERMANENT]: {
      module: AUDIT_MODULES.OBRAS,
      entityType: AUDIT_ENTITY_TYPES.PROJECT,
      severity: AUDIT_SEVERITIES.CRITICAL,
    },
    [AUDIT_ACTIONS.EMPLOYEE_CREATE]: {
      module: AUDIT_MODULES.RRHH,
      entityType: AUDIT_ENTITY_TYPES.EMPLOYEE,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.EMPLOYEE_UPDATE]: {
      module: AUDIT_MODULES.RRHH,
      entityType: AUDIT_ENTITY_TYPES.EMPLOYEE,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.EMPLOYEE_DEACTIVATE]: {
      module: AUDIT_MODULES.RRHH,
      entityType: AUDIT_ENTITY_TYPES.EMPLOYEE,
      severity: AUDIT_SEVERITIES.WARNING,
    },
    [AUDIT_ACTIONS.EMPLOYEE_REACTIVATE]: {
      module: AUDIT_MODULES.RRHH,
      entityType: AUDIT_ENTITY_TYPES.EMPLOYEE,
      severity: AUDIT_SEVERITIES.WARNING,
    },
    [AUDIT_ACTIONS.CREW_CREATE]: {
      module: AUDIT_MODULES.RRHH,
      entityType: AUDIT_ENTITY_TYPES.CREW,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.CREW_UPDATE]: {
      module: AUDIT_MODULES.RRHH,
      entityType: AUDIT_ENTITY_TYPES.CREW,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.CREW_ARCHIVE]: {
      module: AUDIT_MODULES.RRHH,
      entityType: AUDIT_ENTITY_TYPES.CREW,
      severity: AUDIT_SEVERITIES.WARNING,
    },
    [AUDIT_ACTIONS.CREW_MEMBER_ADD]: {
      module: AUDIT_MODULES.RRHH,
      entityType: AUDIT_ENTITY_TYPES.CREW,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.CREW_MEMBER_REMOVE]: {
      module: AUDIT_MODULES.RRHH,
      entityType: AUDIT_ENTITY_TYPES.CREW,
      severity: AUDIT_SEVERITIES.WARNING,
    },
    [AUDIT_ACTIONS.AVAILABILITY_CHANGE]: {
      module: AUDIT_MODULES.RRHH,
      entityType: AUDIT_ENTITY_TYPES.EMPLOYEE,
      severity: AUDIT_SEVERITIES.WARNING,
    },
    [AUDIT_ACTIONS.USER_LOGIN]: {
      module: AUDIT_MODULES.USUARIOS,
      entityType: AUDIT_ENTITY_TYPES.SESSION,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.USER_LOGOUT]: {
      module: AUDIT_MODULES.USUARIOS,
      entityType: AUDIT_ENTITY_TYPES.SESSION,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.USER_CREATE]: {
      module: AUDIT_MODULES.USUARIOS,
      entityType: AUDIT_ENTITY_TYPES.USER,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.USER_PROVISION]: {
      module: AUDIT_MODULES.USUARIOS,
      entityType: AUDIT_ENTITY_TYPES.USER,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.USER_DEACTIVATE]: {
      module: AUDIT_MODULES.USUARIOS,
      entityType: AUDIT_ENTITY_TYPES.USER,
      severity: AUDIT_SEVERITIES.WARNING,
    },
    [AUDIT_ACTIONS.USER_REACTIVATE]: {
      module: AUDIT_MODULES.USUARIOS,
      entityType: AUDIT_ENTITY_TYPES.USER,
      severity: AUDIT_SEVERITIES.WARNING,
    },
    [AUDIT_ACTIONS.USER_PASSWORD_RESET]: {
      module: AUDIT_MODULES.USUARIOS,
      entityType: AUDIT_ENTITY_TYPES.USER,
      severity: AUDIT_SEVERITIES.CRITICAL,
    },
    [AUDIT_ACTIONS.USER_ROLE_CHANGE]: {
      module: AUDIT_MODULES.USUARIOS,
      entityType: AUDIT_ENTITY_TYPES.USER,
      severity: AUDIT_SEVERITIES.CRITICAL,
    },
    [AUDIT_ACTIONS.MOBILE_DEVICE_REGISTERED]: {
      module: AUDIT_MODULES.SISTEMA,
      entityType: AUDIT_ENTITY_TYPES.MOBILE_DEVICE,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.MOBILE_DEVICE_ACTIVATED]: {
      module: AUDIT_MODULES.SISTEMA,
      entityType: AUDIT_ENTITY_TYPES.MOBILE_DEVICE,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.MOBILE_DEVICE_BLOCKED]: {
      module: AUDIT_MODULES.SISTEMA,
      entityType: AUDIT_ENTITY_TYPES.MOBILE_DEVICE,
      severity: AUDIT_SEVERITIES.WARNING,
    },
    [AUDIT_ACTIONS.SHIFT_STARTED]: {
      module: AUDIT_MODULES.SISTEMA,
      entityType: AUDIT_ENTITY_TYPES.WORK_TEAM_SHIFT,
      severity: AUDIT_SEVERITIES.INFO,
    },
    [AUDIT_ACTIONS.SHIFT_FINISHED]: {
      module: AUDIT_MODULES.SISTEMA,
      entityType: AUDIT_ENTITY_TYPES.WORK_TEAM_SHIFT,
      severity: AUDIT_SEVERITIES.INFO,
    },
  }

export function isAuditAction(value: string): value is AuditAction {
  return value in AUDIT_ACTION_DEFINITIONS
}

export function resolveAuditSeverity(action: AuditAction): AuditSeverity {
  return AUDIT_ACTION_DEFINITIONS[action].severity
}

export function resolveAuditActionDefinition(action: AuditAction) {
  return AUDIT_ACTION_DEFINITIONS[action]
}
