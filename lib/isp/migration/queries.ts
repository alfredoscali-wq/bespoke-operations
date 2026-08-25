import type { SupabaseClient } from "@supabase/supabase-js"

import { ISP_MIGRATION_NO_REAL_DATA_MESSAGE } from "@/lib/isp/migration/constants"
import { maskMigrationIssues } from "@/lib/isp/migration/mask"
import type { IspMigrationStoredRow } from "@/lib/isp/migration/review"
import type {
  IspMigrationExistingState,
  IspMigrationIssue,
  IspMigrationRunSummary,
  IspMigrationStagingRow,
  IspMigrationValidationResult,
} from "@/lib/isp/migration/types"
import type { Database, Json } from "@/lib/supabase/database.types"

export type IspMigrationQueriesClient = SupabaseClient<Database>

const STAGING_CHUNK = 200

function asJson(value: unknown): Json {
  return value as Json
}

function runStatusFromValidation(
  validation: IspMigrationValidationResult
): IspMigrationRunSummary["status"] {
  return validation.runStatus
}

function resultMessageFromValidation(
  validation: IspMigrationValidationResult,
  mode: "create" | "update"
): string {
  if (validation.runStatus === "no_real_data") {
    return `Validación completada. ${ISP_MIGRATION_NO_REAL_DATA_MESSAGE}`
  }
  if (!validation.canImport) {
    return mode === "create"
      ? "Validación con errores bloqueantes. Revise los registros o cargue una versión corregida."
      : "Quedan errores bloqueantes. Revise los registros o cargue una versión corregida."
  }
  return mode === "create"
    ? "Validación completada. Pendiente de revisión. Los datos no se importaron todavía."
    : "Corrección aplicada. Pendiente de revisión. Los datos no se importaron todavía."
}

function mapRun(
  row: Database["public"]["Tables"]["isp_migration_runs"]["Row"]
): IspMigrationRunSummary {
  return {
    id: row.id,
    companyId: row.company_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdBy: row.created_by,
    createdByLabel: row.created_by_label,
    filename: row.filename,
    fileSha256: row.file_sha256,
    status: row.status as IspMigrationRunSummary["status"],
    customersCount: row.customers_count,
    catalogCount: row.catalog_count,
    servicesCount: row.services_count,
    connectionsCount: row.connections_count,
    equipmentCount: row.equipment_count,
    errorsCount: row.errors_count,
    warningsCount: row.warnings_count,
    importedCustomersCount: row.imported_customers_count,
    importedCatalogCount: row.imported_catalog_count,
    importedServicesCount: row.imported_services_count,
    importedConnectionsCount: row.imported_connections_count,
    importedEquipmentCount: row.imported_equipment_count,
    resultMessage: row.result_message,
    summary: (row.summary ?? {}) as Record<string, unknown>,
  }
}

export async function getIspOnboardingCutoff(
  client: IspMigrationQueriesClient,
  companyId: string
): Promise<string | null> {
  const { data, error } = await client
    .from("isp_company_settings")
    .select("onboarding_cutoff_at")
    .eq("company_id", companyId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data?.onboarding_cutoff_at ?? null
}

export async function loadIspMigrationExistingState(
  client: IspMigrationQueriesClient,
  companyId: string
): Promise<IspMigrationExistingState> {
  const [
    customers,
    catalog,
    services,
    connections,
    equipment,
    completedRuns,
  ] = await Promise.all([
    client
      .from("customers")
      .select("id, external_customer_code, dni")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    client
      .from("isp_service_catalog")
      .select("id, external_code, name")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    client
      .from("isp_services")
      .select("id, external_code")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    client
      .from("isp_connections")
      .select("id, external_code, service_id, ip_address, pppoe_username")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    client
      .from("isp_connection_equipment")
      .select("external_code")
      .eq("company_id", companyId)
      .is("deleted_at", null),
    client
      .from("isp_migration_runs")
      .select("file_sha256")
      .eq("company_id", companyId)
      .eq("status", "completed"),
  ])

  if (customers.error) throw new Error(customers.error.message)
  if (catalog.error) throw new Error(catalog.error.message)
  if (services.error) throw new Error(services.error.message)
  if (connections.error) throw new Error(connections.error.message)
  if (equipment.error) throw new Error(equipment.error.message)
  if (completedRuns.error) throw new Error(completedRuns.error.message)

  const servicesWithConnection = new Set(
    (connections.data ?? []).map((row) => row.service_id)
  )

  return {
    customers: (customers.data ?? []).map((row) => ({
      id: row.id,
      externalCode: row.external_customer_code,
      dniDigits: (row.dni ?? "").replace(/\D/g, ""),
    })),
    catalog: (catalog.data ?? []).map((row) => ({
      id: row.id,
      externalCode: row.external_code,
      name: row.name,
    })),
    services: (services.data ?? []).map((row) => ({
      id: row.id,
      externalCode: row.external_code,
      hasConnection: servicesWithConnection.has(row.id),
    })),
    connections: (connections.data ?? []).map((row) => ({
      id: row.id,
      externalCode: row.external_code,
      ip: row.ip_address,
      pppoeUsername: row.pppoe_username,
    })),
    equipmentExternalCodes: (equipment.data ?? [])
      .map((row) => row.external_code)
      .filter((code): code is string => Boolean(code)),
    completedFileHashes: (completedRuns.data ?? [])
      .map((row) => row.file_sha256)
      .filter((hash): hash is string => Boolean(hash)),
  }
}

export async function createIspMigrationRun(
  client: IspMigrationQueriesClient,
  input: {
    companyId: string
    createdBy: string | null
    createdByLabel: string
    filename: string
    fileSha256: string
    validation: IspMigrationValidationResult
  }
) {
  const maskedIssues = maskMigrationIssues(input.validation.issues).slice(0, 500)
  const status = runStatusFromValidation(input.validation)

  const { data, error } = await client
    .from("isp_migration_runs")
    .insert({
      company_id: input.companyId,
      created_by: input.createdBy,
      created_by_label: input.createdByLabel,
      filename: input.filename,
      file_sha256: input.fileSha256,
      status,
      customers_count: input.validation.preview.customers,
      catalog_count: input.validation.preview.catalog,
      services_count: input.validation.preview.services,
      connections_count: input.validation.preview.connections,
      equipment_count: input.validation.preview.equipment,
      errors_count: input.validation.preview.errors,
      warnings_count: input.validation.preview.warnings,
      summary: asJson({
        preview: input.validation.preview,
        counts: input.validation.counts,
        issues: maskedIssues,
        duplicateCompletedRun: input.validation.duplicateCompletedRun,
        usedHistoricalWorkOrders: false,
        hasRealData: input.validation.hasRealData,
        examplesIgnored: input.validation.preview.examplesIgnored,
      }),
      result_message: resultMessageFromValidation(input.validation, "create"),
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo registrar la validación.")
  }

  if (input.validation.stagingRows.length > 0) {
    await insertStagingRows(client, data.id, input.companyId, input.validation.stagingRows)
  }
  return mapRun(data)
}

async function insertStagingRows(
  client: IspMigrationQueriesClient,
  runId: string,
  companyId: string,
  rows: IspMigrationStagingRow[]
) {
  for (let index = 0; index < rows.length; index += STAGING_CHUNK) {
    const chunk = rows.slice(index, index + STAGING_CHUNK)
    const { error } = await client.from("isp_migration_staging_rows").insert(
      chunk.map((row) => ({
        run_id: runId,
        company_id: companyId,
        sheet: row.sheet,
        row_number: row.rowNumber,
        payload: asJson(row.payload),
        validation_status: row.validationStatus,
        issues: asJson(maskMigrationIssues(row.issues)),
      }))
    )
    if (error) throw new Error(error.message)
  }
}

export async function listIspMigrationRuns(
  client: IspMigrationQueriesClient,
  companyId: string
): Promise<IspMigrationRunSummary[]> {
  const { data, error } = await client
    .from("isp_migration_runs")
    .select("*")
    .eq("company_id", companyId)
    .order("started_at", { ascending: false })
    .limit(50)

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRun)
}

export async function getIspMigrationRun(
  client: IspMigrationQueriesClient,
  companyId: string,
  runId: string
): Promise<IspMigrationRunSummary | null> {
  const { data, error } = await client
    .from("isp_migration_runs")
    .select("*")
    .eq("company_id", companyId)
    .eq("id", runId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapRun(data) : null
}

export async function importIspMigrationRun(
  client: IspMigrationQueriesClient,
  runId: string,
  forceReimport: boolean
) {
  const { data, error } = await client.rpc("import_isp_migration", {
    p_run_id: runId,
    p_force: forceReimport,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export function sanitizeMigrationFilename(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "abonados_isp.xlsx"
  return base.slice(0, 180) || "abonados_isp.xlsx"
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function asIssues(value: unknown): IspMigrationIssue[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is IspMigrationIssue => {
    return Boolean(item && typeof item === "object")
  })
}

export async function listIspMigrationStagingRows(
  client: IspMigrationQueriesClient,
  companyId: string,
  runId: string
): Promise<IspMigrationStoredRow[]> {
  const { data, error } = await client
    .from("isp_migration_staging_rows")
    .select("*")
    .eq("company_id", companyId)
    .eq("run_id", runId)
    .order("sheet", { ascending: true })
    .order("row_number", { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    id: row.id,
    sheet: row.sheet as IspMigrationStoredRow["sheet"],
    rowNumber: row.row_number,
    payload: asRecord(row.payload),
    validationStatus: row.validation_status as IspMigrationStoredRow["validationStatus"],
    issues: asIssues(row.issues),
  }))
}

export async function replaceIspMigrationStaging(
  client: IspMigrationQueriesClient,
  runId: string,
  companyId: string,
  rows: IspMigrationStagingRow[]
) {
  const { error: deleteError } = await client
    .from("isp_migration_staging_rows")
    .delete()
    .eq("run_id", runId)
    .eq("company_id", companyId)

  if (deleteError) throw new Error(deleteError.message)
  await insertStagingRows(client, runId, companyId, rows)
}

export async function updateIspMigrationRunValidation(
  client: IspMigrationQueriesClient,
  input: {
    companyId: string
    runId: string
    validation: IspMigrationValidationResult
  }
): Promise<IspMigrationRunSummary> {
  const maskedIssues = maskMigrationIssues(input.validation.issues).slice(0, 500)
  const { data, error } = await client
    .from("isp_migration_runs")
    .update({
      status: runStatusFromValidation(input.validation),
      customers_count: input.validation.preview.customers,
      catalog_count: input.validation.preview.catalog,
      services_count: input.validation.preview.services,
      connections_count: input.validation.preview.connections,
      equipment_count: input.validation.preview.equipment,
      errors_count: input.validation.preview.errors,
      warnings_count: input.validation.preview.warnings,
      summary: asJson({
        preview: input.validation.preview,
        counts: input.validation.counts,
        issues: maskedIssues,
        duplicateCompletedRun: input.validation.duplicateCompletedRun,
        usedHistoricalWorkOrders: false,
        hasRealData: input.validation.hasRealData,
        examplesIgnored: input.validation.preview.examplesIgnored,
      }),
      result_message: resultMessageFromValidation(input.validation, "update"),
    })
    .eq("id", input.runId)
    .eq("company_id", input.companyId)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo actualizar la revisión.")
  }

  await replaceIspMigrationStaging(
    client,
    input.runId,
    input.companyId,
    input.validation.stagingRows
  )

  return mapRun(data)
}
