export {
  AUDIT_ACTION_DEFINITIONS,
  isAuditAction,
  resolveAuditActionDefinition,
  resolveAuditSeverity,
} from "@/lib/audit/audit-catalog"
export {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_TYPE_LABELS,
  AUDIT_MODULE_LABELS,
  AUDIT_SEVERITY_LABELS,
  formatAuditActionLabel,
  formatAuditEntityTypeLabel,
  formatAuditModuleLabel,
  formatAuditSeverityLabel,
} from "@/lib/audit/audit-labels"
export { buildAuditDescription } from "@/lib/audit/build-audit-description"
export {
  buildAuditChangeMetadata,
  buildAuditFieldChanges,
  normalizeAuditValue,
  type AuditFieldChange,
} from "@/lib/audit/metadata-changes"
export {
  queryAuditLogs,
  validateWriteAuditLogInput,
  writeAuditLog,
} from "@/lib/audit/audit-service"
export { recordAuditEventClient } from "@/lib/audit/record-audit-event.client"
export { recordAuditEventServer } from "@/lib/audit/record-audit-event.server"
export {
  getClientAuditRejectionMessage,
  isClientWritableAuditAction,
  isServerOnlyAuditAction,
  SERVER_ONLY_AUDIT_ACTIONS,
} from "@/lib/audit/client-policy"
export {
  isCustomerArchiveUpdate,
  recordCustomerArchiveAudit,
  recordCustomerCreateAudit,
  recordCustomerDeleteAudit,
  recordCustomerUpdateAudit,
  recordCustomerValidateAudit,
} from "@/lib/audit/customers-audit"
export {
  mapWorkflowActionToAuditAction,
  recordTaskAssignCrewAudit,
  recordTaskCreateAudit,
  recordTaskDeleteAudit,
  recordTaskMutationAudit,
  recordTaskRescheduleAudit,
  recordTaskUpdateAudit,
  recordTaskWorkflowStatusAudit,
  type TaskMutationAuditContext,
} from "@/lib/audit/tasks-audit"
export {
  buildTaskCrewMetadata,
  buildTaskScheduleMetadata,
  buildTaskStatusMetadata,
  buildTaskVencidaAuditMetadata,
  resolveTaskEntityLabel,
} from "@/lib/audit/tasks-audit-shared"
export {
  parseAuditRevision,
  resolveNextEntityAuditRevision,
  shouldAssignEntityAuditRevision,
} from "@/lib/audit/entity-revision"
export {
  buildProjectDeletePermanentAuditMetadata,
  buildProjectStatusMetadata,
  buildProjectStatusMetadataFromTransition,
  isProjectAuditableFieldUpdate,
  isProjectStatusUpdate,
  recordProjectArchiveAudit,
  recordProjectCreateAudit,
  recordProjectStatusChangeAudit,
  recordProjectStatusChangeAuditFromTransition,
  recordProjectUpdateAudit,
  resolveProjectEntityLabel,
} from "@/lib/audit/projects-audit"
export {
  buildCrewStatusMetadata,
  buildCrewStatusTransitionMetadata,
  buildEmploymentStatusMetadata,
  buildEmploymentStatusTransitionMetadata,
  isCrewAuditableFieldUpdate,
  isEmployeeDeactivation,
  isEmployeeReactivation,
  recordAvailabilityChangeAudit,
  recordCrewArchiveAudit,
  recordCrewCreateAudit,
  recordCrewMemberAddAudit,
  recordCrewMemberRemoveAudit,
  recordCrewUpdateAudit,
  recordEmployeeCreateAudit,
  recordEmployeeDeactivateAudit,
  recordEmployeeEditAudit,
  recordEmployeeReactivateAudit,
  recordEmployeeUpdateAudit,
  resolveCrewEntityLabel,
  resolveEmployeeEntityLabel,
  type AvailabilityAuditOperation,
} from "@/lib/audit/rrhh-audit"
export {
  buildUserRoleMetadata,
  hasUserAccountFieldChanges,
  recordUserAccountChangesViaApi,
  recordUserSessionAudit,
  resolveUserEntityId,
  resolveUserEntityLabel,
  stripUserAccountFieldsFromEmployeeUpdate,
  USER_ACCOUNT_FIELDS,
  type RecordUserAccountAuditInput,
} from "@/lib/audit/users-audit"
export {
  recordUserAccountChangesAudit,
  recordUserCreateAudit,
  recordUserDeactivateAudit,
  recordUserLoginAudit,
  recordUserLogoutAudit,
  recordUserPasswordResetAudit,
  recordUserProvisionAudit,
  recordUserReactivateAudit,
  recordUserRoleChangeAudit,
} from "@/lib/audit/users-audit.server"
export {
  SYSTEM_AUDIT_ACTOR,
  SYSTEM_AUDIT_ACTOR_NAME,
} from "@/lib/audit/system-actor"
export {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  AUDIT_MODULES,
  AUDIT_SEVERITIES,
  type AuditAction,
  type AuditActor,
  type AuditEntityType,
  type AuditLogEntry,
  type AuditLogQuery,
  type AuditLogQueryResult,
  type AuditModule,
  type AuditSeverity,
  type WriteAuditLogInput,
} from "@/lib/audit/types"
