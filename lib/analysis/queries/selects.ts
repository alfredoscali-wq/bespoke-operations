/**
 * Explicit column lists for Análisis (Sprint 16).
 * No SELECT * — only columns consumed by Analysis screens.
 */

/** Shared by Sala, Workforce, Jornada (union of name + area/role filters). */
export const ANALYSIS_EMPLOYEE_SELECT = [
  "id",
  "first_name",
  "last_name",
  "preferred_name",
  "department",
  "system_role",
].join(", ")

/**
 * Reportes Operativos — management report / filters / export.
 * Omits large unused payloads (checklist, operational_steps, GPS blobs, etc.).
 */
export const ANALYSIS_REPORTES_TASK_SELECT = [
  "id",
  "code",
  "title",
  "status",
  "type",
  "priority",
  "due_date",
  "start_date",
  "completed_at",
  "closed_at",
  "service_type",
  "locality",
  "customer_name",
  "project_id",
  "project_code",
  "project_name",
  "crew_id",
  "crew",
  "supervisor",
  "estimated_duration",
  "progress",
  "created_at",
  "task_metadata",
].join(", ")

export const ANALYSIS_REPORTES_PROJECT_SELECT = [
  "id",
  "code",
  "name",
  "status",
  "progress",
  "end_date",
  "type",
  "client",
  "supervisor",
  "location",
  "description",
  "created_at",
].join(", ")

/** Reportes only needs id + name for filters and productivity labels. */
export const ANALYSIS_REPORTES_CREW_SELECT = ["id", "name"].join(", ")
