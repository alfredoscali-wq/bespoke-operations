/**
 * Stable manual aliases over generated Database types.
 * Kept outside database.types.ts so `supabase gen types` never overwrites them.
 */
import type { Database } from "@/lib/supabase/database.types"

export type CompanyRow = Database["public"]["Tables"]["companies"]["Row"]
export type CompanyInsert = Database["public"]["Tables"]["companies"]["Insert"]
export type CompanyUpdate = Database["public"]["Tables"]["companies"]["Update"]
export type ContractorRow = Database["public"]["Tables"]["contractors"]["Row"]
export type ContractorInsert =
  Database["public"]["Tables"]["contractors"]["Insert"]
export type ContractorUpdate =
  Database["public"]["Tables"]["contractors"]["Update"]
export type CustomerAtencionRow =
  Database["public"]["Tables"]["customer_atenciones"]["Row"]
export type CustomerAtencionInsert =
  Database["public"]["Tables"]["customer_atenciones"]["Insert"]
export type CustomerAtencionUpdate =
  Database["public"]["Tables"]["customer_atenciones"]["Update"]
export type CustomerAtencionEventRow =
  Database["public"]["Tables"]["customer_atencion_events"]["Row"]
export type CustomerAtencionEventInsert =
  Database["public"]["Tables"]["customer_atencion_events"]["Insert"]
export type CustomerAtencionEventUpdate =
  Database["public"]["Tables"]["customer_atencion_events"]["Update"]
export type CustomerSeguimientoRow =
  Database["public"]["Tables"]["customer_seguimientos"]["Row"]
export type CustomerSeguimientoInsert =
  Database["public"]["Tables"]["customer_seguimientos"]["Insert"]
export type CustomerSeguimientoUpdate =
  Database["public"]["Tables"]["customer_seguimientos"]["Update"]
export type CustomerRetencionRow =
  Database["public"]["Tables"]["customer_retenciones"]["Row"]
export type CustomerRetencionInsert =
  Database["public"]["Tables"]["customer_retenciones"]["Insert"]
export type CustomerRetencionUpdate =
  Database["public"]["Tables"]["customer_retenciones"]["Update"]
export type CustomerRecuperacionRow =
  Database["public"]["Tables"]["customer_recuperaciones"]["Row"]
export type CustomerRecuperacionInsert =
  Database["public"]["Tables"]["customer_recuperaciones"]["Insert"]
export type CustomerRecuperacionUpdate =
  Database["public"]["Tables"]["customer_recuperaciones"]["Update"]
export type CustomerRow = Database["public"]["Tables"]["customers"]["Row"]
export type CustomerInsert = Database["public"]["Tables"]["customers"]["Insert"]
export type CustomerUpdate = Database["public"]["Tables"]["customers"]["Update"]
export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]
export type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"]
export type ProjectUpdate = Database["public"]["Tables"]["projects"]["Update"]
export type ProjectHistoryRow =
  Database["public"]["Tables"]["project_history"]["Row"]
export type ProjectHistoryInsert =
  Database["public"]["Tables"]["project_history"]["Insert"]
export type ProjectHistoryUpdate =
  Database["public"]["Tables"]["project_history"]["Update"]
export type SystemAuditLogRow =
  Database["public"]["Tables"]["system_audit_log"]["Row"]
export type SystemAuditLogInsert =
  Database["public"]["Tables"]["system_audit_log"]["Insert"]
export type SystemAuditLogUpdate =
  Database["public"]["Tables"]["system_audit_log"]["Update"]
export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"]
export type TaskInsert = Database["public"]["Tables"]["tasks"]["Insert"]
export type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"]
export type IspServiceCatalogRow =
  Database["public"]["Tables"]["isp_service_catalog"]["Row"]
export type IspServiceCatalogInsert =
  Database["public"]["Tables"]["isp_service_catalog"]["Insert"]
export type IspServiceCatalogUpdate =
  Database["public"]["Tables"]["isp_service_catalog"]["Update"]
export type IspMigrationRunRow =
  Database["public"]["Tables"]["isp_migration_runs"]["Row"]
export type IspCompanySettingsRow =
  Database["public"]["Tables"]["isp_company_settings"]["Row"]
export type TaskPhotoRow = Database["public"]["Tables"]["task_photos"]["Row"]
export type TaskPhotoInsert =
  Database["public"]["Tables"]["task_photos"]["Insert"]
export type TaskPhotoUpdate =
  Database["public"]["Tables"]["task_photos"]["Update"]
export type TaskIncidentRow =
  Database["public"]["Tables"]["task_incidents"]["Row"]
export type TaskIncidentInsert =
  Database["public"]["Tables"]["task_incidents"]["Insert"]
export type TaskIncidentUpdate =
  Database["public"]["Tables"]["task_incidents"]["Update"]
export type TaskIncidentPhotoRow =
  Database["public"]["Tables"]["task_incident_photos"]["Row"]
export type TaskIncidentPhotoInsert =
  Database["public"]["Tables"]["task_incident_photos"]["Insert"]
export type TaskIncidentPhotoUpdate =
  Database["public"]["Tables"]["task_incident_photos"]["Update"]
export type TaskIncidentEventRow =
  Database["public"]["Tables"]["task_incident_events"]["Row"]
export type TaskIncidentEventInsert =
  Database["public"]["Tables"]["task_incident_events"]["Insert"]
export type TaskIncidentEventUpdate =
  Database["public"]["Tables"]["task_incident_events"]["Update"]
export type EvidenceRow = Database["public"]["Tables"]["evidences"]["Row"]
export type EvidenceInsert =
  Database["public"]["Tables"]["evidences"]["Insert"]
export type EvidenceUpdate =
  Database["public"]["Tables"]["evidences"]["Update"]
export type TreasuryMovementRow =
  Database["public"]["Tables"]["treasury_movements"]["Row"]
export type TreasuryMovementInsert =
  Database["public"]["Tables"]["treasury_movements"]["Insert"]
export type TreasuryMovementUpdate =
  Database["public"]["Tables"]["treasury_movements"]["Update"]
export type CommercialPersonRow =
  Database["public"]["Tables"]["commercial_people"]["Row"]
export type CommercialPersonInsert =
  Database["public"]["Tables"]["commercial_people"]["Insert"]
export type CommercialPersonUpdate =
  Database["public"]["Tables"]["commercial_people"]["Update"]
export type CommercialCommitmentRow =
  Database["public"]["Tables"]["commercial_commitments"]["Row"]
export type CommercialCommitmentInsert =
  Database["public"]["Tables"]["commercial_commitments"]["Insert"]
export type CommercialCommitmentUpdate =
  Database["public"]["Tables"]["commercial_commitments"]["Update"]
export type CommercialOpportunityRow =
  Database["public"]["Tables"]["commercial_opportunities"]["Row"]
/**
 * `code` is NOT NULL without a column DEFAULT, so supabase gen types marks it
 * required on Insert. A BEFORE INSERT trigger
 * (`assign_commercial_opportunity_code`) auto-generates OP-###### when `code`
 * is omitted or blank; callers may omit it.
 */
export type CommercialOpportunityInsert = Omit<
  Database["public"]["Tables"]["commercial_opportunities"]["Insert"],
  "code"
> & {
  code?: string
}
export type CommercialOpportunityUpdate =
  Database["public"]["Tables"]["commercial_opportunities"]["Update"]
export type CommercialActivityTypeRow =
  Database["public"]["Tables"]["commercial_activity_types"]["Row"]
export type CommercialActivityTypeInsert =
  Database["public"]["Tables"]["commercial_activity_types"]["Insert"]
export type CommercialActivityTypeUpdate =
  Database["public"]["Tables"]["commercial_activity_types"]["Update"]
export type CommercialActivityRow =
  Database["public"]["Tables"]["commercial_activities"]["Row"]
export type CommercialActivityInsert =
  Database["public"]["Tables"]["commercial_activities"]["Insert"]
export type CommercialActivityUpdate =
  Database["public"]["Tables"]["commercial_activities"]["Update"]
export type CrewRow = Database["public"]["Tables"]["crews"]["Row"]
export type CrewInsert = Database["public"]["Tables"]["crews"]["Insert"]
export type CrewUpdate = Database["public"]["Tables"]["crews"]["Update"]
export type CrewMemberRow = Database["public"]["Tables"]["crew_members"]["Row"]
export type CrewMemberInsert =
  Database["public"]["Tables"]["crew_members"]["Insert"]
export type CrewMemberUpdate =
  Database["public"]["Tables"]["crew_members"]["Update"]
export type EmployeeRow = Database["public"]["Tables"]["employees"]["Row"]
export type EmployeeInsert =
  Database["public"]["Tables"]["employees"]["Insert"]
export type EmployeeUpdate =
  Database["public"]["Tables"]["employees"]["Update"]
export type EmployeeAvailabilityRow =
  Database["public"]["Tables"]["employee_availability"]["Row"]
export type EmployeeAvailabilityInsert =
  Database["public"]["Tables"]["employee_availability"]["Insert"]
export type EmployeeAvailabilityUpdate =
  Database["public"]["Tables"]["employee_availability"]["Update"]
