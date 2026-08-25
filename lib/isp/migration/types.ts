import type { IspMigrationSheetName } from "@/lib/isp/migration/constants"
import type {
  IspCatalogBillingMethod,
  IspCatalogBillingPeriod,
  IspCatalogCategory,
  IspCatalogCustomerType,
  IspCatalogTechnology,
} from "@/lib/isp/catalog-constants"
import type {
  IspCommercialStatus,
  IspConnectionType,
  IspMonthlyCollectionMethod,
  IspTechnicalStatus,
} from "@/lib/isp/constants"

export type IspMigrationIssueLevel = "error" | "warning"

export type IspMigrationIssue = {
  sheet: IspMigrationSheetName | "ARCHIVO"
  rowNumber: number
  field: string
  value: string
  level: IspMigrationIssueLevel
  message: string
  code?: string
}

export type IspMigrationParsedRow = {
  rowNumber: number
  values: Record<string, string>
}

export type IspMigrationParsedWorkbook = {
  sheets: Partial<Record<IspMigrationSheetName, IspMigrationParsedRow[]>>
  missingRequiredSheets: string[]
}

export type IspMigrationSheetCounts = {
  total: number
  valid: number
  warnings: number
  errors: number
  examples: number
}

export type IspMigrationStagingRow = {
  sheet: Exclude<IspMigrationSheetName, "INSTRUCCIONES">
  rowNumber: number
  payload: Record<string, unknown>
  validationStatus: "valid" | "warning" | "error"
  issues: IspMigrationIssue[]
}

export type IspMigrationExistingCustomer = {
  id: string
  externalCode: string | null
  dniDigits: string
}

export type IspMigrationExistingCatalog = {
  id: string
  externalCode: string | null
  name: string
}

export type IspMigrationExistingService = {
  id: string
  externalCode: string | null
  hasConnection: boolean
}

export type IspMigrationExistingConnection = {
  id: string
  externalCode: string | null
  ip: string | null
  pppoeUsername: string | null
}

export type IspMigrationExistingState = {
  customers: IspMigrationExistingCustomer[]
  catalog: IspMigrationExistingCatalog[]
  services: IspMigrationExistingService[]
  connections: IspMigrationExistingConnection[]
  equipmentExternalCodes: string[]
  completedFileHashes: string[]
}

export type IspMigrationValidationResult = {
  issues: IspMigrationIssue[]
  counts: Record<
    Exclude<IspMigrationSheetName, "INSTRUCCIONES">,
    IspMigrationSheetCounts
  >
  stagingRows: IspMigrationStagingRow[]
  preview: {
    customers: number
    catalog: number
    services: number
    connections: number
    equipment: number
    warnings: number
    errors: number
    customersWithoutService: number
    servicesWithoutConnection: number
    examplesIgnored: number
  }
  canImport: boolean
  hasRealData: boolean
  runStatus: "pending_review" | "rejected" | "no_real_data"
  duplicateCompletedRun: boolean
}

export type IspMigrationCatalogPayload = {
  catalogo_id_externo: string
  nombre_servicio: string
  descripcion: string
  category: IspCatalogCategory
  customer_type: IspCatalogCustomerType
  technology: IspCatalogTechnology | ""
  download_speed_mbps: number | null
  upload_speed_mbps: number | null
  monthly_price: number | null
  billing_period: IspCatalogBillingPeriod
  billing_method: IspCatalogBillingMethod
  requires_connection: boolean
  allowed_connection_types: IspConnectionType[]
  is_active: boolean
}

export type IspMigrationCustomerPayload = {
  cliente_id_externo: string
  nombre_razon_social: string
  dni_cuit: string
  telefono: string
  whatsapp: string
  email: string
  localidad: string
  domicilio: string
  observaciones: string
  customer_status: "activo" | "inactivo" | "pendiente-activacion"
}

export type IspMigrationServicePayload = {
  servicio_id_externo: string
  cliente_id_externo: string
  catalogo_id_externo: string
  nombre_servicio: string
  technology: string
  contracted_speed: string
  monthly_price: number | null
  fecha_alta: string
  commercial_status: IspCommercialStatus
  billing_method: IspMonthlyCollectionMethod
  observaciones: string
}

export type IspMigrationRunStatus =
  | "validating"
  | "pending_review"
  | "validated"
  | "rejected"
  | "no_real_data"
  | "completed"
  | "failed"

export type IspMigrationRunSummary = {
  id: string
  companyId: string
  startedAt: string
  completedAt: string | null
  createdBy: string | null
  createdByLabel: string | null
  filename: string
  fileSha256: string | null
  status: IspMigrationRunStatus
  customersCount: number
  catalogCount: number
  servicesCount: number
  connectionsCount: number
  equipmentCount: number
  errorsCount: number
  warningsCount: number
  importedCustomersCount: number
  importedCatalogCount: number
  importedServicesCount: number
  importedConnectionsCount: number
  importedEquipmentCount: number
  resultMessage: string | null
  summary: Record<string, unknown>
}
