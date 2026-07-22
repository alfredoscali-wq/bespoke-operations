import { AUDIT_ACTIONS, type AuditAction } from "@/lib/audit/types"

export type AuditActionVisualGroup =
  | "create"
  | "edit"
  | "delete"
  | "login"
  | "logout"
  | "approval"
  | "warning"
  | "error"
  | "other"

export const AUDIT_ACTION_VISUAL_GROUP_LABELS: Record<
  AuditActionVisualGroup,
  string
> = {
  create: "Creación",
  edit: "Edición",
  delete: "Eliminación",
  login: "Login",
  logout: "Logout",
  approval: "Aprobación",
  warning: "Advertencia",
  error: "Error",
  other: "Otro",
}

const CREATE_ACTIONS = new Set<string>([
  AUDIT_ACTIONS.CUSTOMER_CREATE,
  AUDIT_ACTIONS.TASK_CREATE,
  AUDIT_ACTIONS.PROJECT_CREATE,
  AUDIT_ACTIONS.EMPLOYEE_CREATE,
  AUDIT_ACTIONS.CREW_CREATE,
  AUDIT_ACTIONS.CREW_MEMBER_ADD,
  AUDIT_ACTIONS.USER_CREATE,
  AUDIT_ACTIONS.USER_PROVISION,
])

const EDIT_ACTIONS = new Set<string>([
  AUDIT_ACTIONS.CUSTOMER_UPDATE,
  AUDIT_ACTIONS.TASK_UPDATE,
  AUDIT_ACTIONS.TASK_ASSIGN_CREW,
  AUDIT_ACTIONS.PLANNING_CONFIRMED,
  AUDIT_ACTIONS.TASK_RESCHEDULE,
  AUDIT_ACTIONS.TASK_STATUS_EN_CURSO,
  AUDIT_ACTIONS.TASK_STATUS_VENCIDA,
  AUDIT_ACTIONS.PROJECT_UPDATE,
  AUDIT_ACTIONS.PROJECT_STATUS_CHANGE,
  AUDIT_ACTIONS.EMPLOYEE_UPDATE,
  AUDIT_ACTIONS.EMPLOYEE_REACTIVATE,
  AUDIT_ACTIONS.CREW_UPDATE,
  AUDIT_ACTIONS.AVAILABILITY_CHANGE,
  AUDIT_ACTIONS.USER_REACTIVATE,
])

const DELETE_ACTIONS = new Set<string>([
  AUDIT_ACTIONS.CUSTOMER_ARCHIVE,
  AUDIT_ACTIONS.CUSTOMER_DELETE,
  AUDIT_ACTIONS.CUSTOMER_DELETE_PERMANENT,
  AUDIT_ACTIONS.TASK_DELETE,
  AUDIT_ACTIONS.TASK_DELETE_PERMANENT,
  AUDIT_ACTIONS.PROJECT_ARCHIVE,
  AUDIT_ACTIONS.PROJECT_DELETE_PERMANENT,
  AUDIT_ACTIONS.CONTRACTOR_DELETE_PERMANENT,
  AUDIT_ACTIONS.EMPLOYEE_DEACTIVATE,
  AUDIT_ACTIONS.CREW_ARCHIVE,
  AUDIT_ACTIONS.CREW_MEMBER_REMOVE,
  AUDIT_ACTIONS.USER_DEACTIVATE,
])

const APPROVAL_ACTIONS = new Set<string>([
  AUDIT_ACTIONS.CUSTOMER_VALIDATE,
  AUDIT_ACTIONS.TASK_REQUEST_CLOSE,
  AUDIT_ACTIONS.TASK_FINISH,
  AUDIT_ACTIONS.TASK_CLOSE,
  AUDIT_ACTIONS.USER_ROLE_CHANGE,
  AUDIT_ACTIONS.USER_PASSWORD_RESET,
  AUDIT_ACTIONS.INCIDENT_CLOSED,
])

const WARNING_ACTIONS = new Set<string>([
  AUDIT_ACTIONS.INCIDENT_CREATED,
  AUDIT_ACTIONS.INCIDENT_SUPERVISOR_ACTION,
])

export function resolveAuditActionVisualGroup(
  action: string,
  severity?: string
): AuditActionVisualGroup {
  if (action === AUDIT_ACTIONS.USER_LOGIN) return "login"
  if (action === AUDIT_ACTIONS.USER_LOGOUT) return "logout"
  if (CREATE_ACTIONS.has(action)) return "create"
  if (DELETE_ACTIONS.has(action)) return "delete"
  if (APPROVAL_ACTIONS.has(action)) return "approval"
  if (EDIT_ACTIONS.has(action)) return "edit"
  if (WARNING_ACTIONS.has(action)) return "warning"
  if (severity === "CRITICAL") return "error"
  if (severity === "WARNING") return "warning"
  return "other"
}

export const AUDIT_ACTION_BADGE_CLASSES: Record<AuditActionVisualGroup, string> =
  {
    create:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    edit: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300",
    delete:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
    login:
      "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300",
    logout:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
    approval:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    warning:
      "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300",
    error:
      "border-destructive/30 bg-destructive/10 text-destructive dark:border-destructive/40 dark:bg-destructive/15",
    other:
      "border-border bg-muted/40 text-muted-foreground",
  }
