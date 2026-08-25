import {
  isIspConnectionType,
  isIspMonthlyCollectionMethod,
  isIspTechnicalStatus,
  isIspTechnology,
} from "@/lib/isp/labels"
import { resolveEffectiveCommercialStatus } from "@/lib/isp/subscriber-service-integrity"
import type { IspConnection, IspService } from "@/lib/isp/types"
import type { Database } from "@/lib/supabase/database.types"

type IspServiceRow = Database["public"]["Tables"]["isp_services"]["Row"]
type IspConnectionRow = Database["public"]["Tables"]["isp_connections"]["Row"]

export function mapIspServiceRow(row: IspServiceRow): IspService {
  const technology = row.technology ?? ""
  return {
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    catalogId: row.catalog_id,
    catalogCode: row.catalog_code,
    externalCode: row.external_code,
    technology: isIspTechnology(technology) ? technology : null,
    planName: row.plan_name,
    contractedSpeed: row.contracted_speed,
    downloadSpeed: row.download_speed,
    uploadSpeed: row.upload_speed,
    speedUnit: row.speed_unit,
    listPrice: row.list_price,
    monthlyFee: row.monthly_fee,
    activationDate: row.activation_date,
    commercialStatus: resolveEffectiveCommercialStatus({
      storedStatus: row.commercial_status,
      activationDate: row.activation_date,
    }),
    monthlyCollectionMethod: isIspMonthlyCollectionMethod(
      row.monthly_collection_method
    )
      ? row.monthly_collection_method
      : "pending",
    sourceTaskId: row.source_task_id,
    notes: row.notes,
    replacedServiceId: row.replaced_service_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapIspConnectionRow(
  row: IspConnectionRow,
  customerId: string,
  options?: { includePassword?: boolean }
): IspConnection {
  const passwordSet = Boolean(row.pppoe_password)
  return {
    id: row.id,
    companyId: row.company_id,
    serviceId: row.service_id,
    customerId,
    externalCode: row.external_code,
    notes: row.notes,
    connectionType: isIspConnectionType(row.connection_type)
      ? row.connection_type
      : "other",
    pppoeUsername: row.pppoe_username,
    pppoePassword: options?.includePassword ? row.pppoe_password : null,
    pppoePasswordSet: passwordSet,
    technicalProfile: row.technical_profile,
    technicalProfileId: row.technical_profile_id,
    ipAddress: row.ip_address,
    prefixLength: row.prefix_length,
    gateway: row.gateway,
    vlan: row.vlan,
    coreName: row.core_name,
    coreProfileId: row.core_profile_id,
    technicalStatus: isIspTechnicalStatus(row.technical_status)
      ? row.technical_status
      : "pending_provision",
    lastSyncAt: row.last_sync_at,
    provisionError: row.provision_error,
    sourceTaskId: row.source_task_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
