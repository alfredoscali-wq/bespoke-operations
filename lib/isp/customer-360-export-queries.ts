import type { IspQueriesClient } from "@/lib/isp/queries"
import { resolveEffectiveCommercialStatus } from "@/lib/isp/subscriber-service-integrity"
import {
  buildIspCustomer360ExportRows,
  type IspCustomer360ExportCatalog,
  type IspCustomer360ExportCustomer,
  type IspCustomer360ExportRow,
  type IspCustomer360ExportService,
  type IspCustomer360ExportTvPlan,
} from "@/lib/isp/customer-360-export"

const PAGE_SIZE = 1000
const CUSTOMER_ID_CHUNK = 80

function chunkIds(ids: string[], size = CUSTOMER_ID_CHUNK): string[][] {
  const chunks: string[][] = []
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size))
  }
  return chunks
}

async function fetchAllRows<T>(
  loadPage: (from: number, to: number) => Promise<T[]>
): Promise<T[]> {
  const rows: T[] = []
  let from = 0
  while (true) {
    const page = await loadPage(from, from + PAGE_SIZE - 1)
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

export async function listActiveIspCustomersForExcelExport(
  client: IspQueriesClient,
  companyId: string
): Promise<IspCustomer360ExportRow[]> {
  const members = await fetchAllRows(async (from, to) => {
    const { data, error } = await client
      .from("isp_subscribers")
      .select("customer_id, deleted_at")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(from, to)
    if (error) throw new Error(error.message)
    return data ?? []
  })

  const subscriberDeletedAtByCustomerId = new Map<string, string | null>()
  const memberIds: string[] = []
  for (const row of members) {
    if (!row.customer_id) continue
    memberIds.push(row.customer_id)
    subscriberDeletedAtByCustomerId.set(row.customer_id, row.deleted_at)
  }

  const customers: IspCustomer360ExportCustomer[] = []
  for (const part of chunkIds([...new Set(memberIds)])) {
    const { data, error } = await client
      .from("customers")
      .select(
        "id, company_id, name, dni, phone, whatsapp, email, address, locality, status, created_at, customer_number, external_customer_code, status_reason, deleted_at"
      )
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .in("id", part)
    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      customers.push({
        id: row.id,
        companyId: row.company_id,
        name: row.name,
        dni: row.dni,
        phone: row.phone,
        whatsapp: row.whatsapp,
        email: row.email,
        address: row.address,
        locality: row.locality,
        status: row.status,
        createdAt: row.created_at,
        customerNumber: row.customer_number,
        externalCustomerCode: row.external_customer_code,
        statusReason: row.status_reason,
        deletedAt: row.deleted_at,
      })
    }
  }

  const serviceRows = await fetchAllRows(async (from, to) => {
    const { data, error } = await client
      .from("isp_services")
      .select(
        "customer_id, catalog_id, catalog_code, plan_name, technology, download_speed, upload_speed, speed_unit, monthly_fee, commercial_status, monthly_collection_method, activation_date, notes, created_at"
      )
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(from, to)
    if (error) throw new Error(error.message)
    return data ?? []
  })

  const servicesByCustomerId = new Map<string, IspCustomer360ExportService[]>()
  const catalogIds = new Set<string>()
  for (const row of serviceRows) {
    const service: IspCustomer360ExportService = {
      customerId: row.customer_id,
      catalogId: row.catalog_id,
      catalogCode: row.catalog_code,
      planName: row.plan_name,
      technology: row.technology,
      downloadSpeed: row.download_speed,
      uploadSpeed: row.upload_speed,
      speedUnit: row.speed_unit,
      monthlyFee: row.monthly_fee,
      commercialStatus: resolveEffectiveCommercialStatus({
        storedStatus: row.commercial_status,
        activationDate: row.activation_date,
      }),
      monthlyCollectionMethod: row.monthly_collection_method,
      activationDate: row.activation_date,
      notes: row.notes,
      createdAt: row.created_at,
    }
    const current = servicesByCustomerId.get(row.customer_id) ?? []
    current.push(service)
    servicesByCustomerId.set(row.customer_id, current)
    if (row.catalog_id) catalogIds.add(row.catalog_id)
  }

  const catalogById = new Map<string, IspCustomer360ExportCatalog>()
  for (const part of chunkIds([...catalogIds])) {
    const { data, error } = await client
      .from("isp_service_catalog")
      .select(
        "id, company_id, code, name, category, technology, download_speed_mbps, upload_speed_mbps, speed_unit, tv_plan_catalog_id"
      )
      .eq("company_id", companyId)
      .in("id", part)
    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      catalogById.set(row.id, {
        id: row.id,
        companyId: row.company_id,
        code: row.code,
        name: row.name,
        category: row.category,
        technology: row.technology,
        downloadSpeedMbps: row.download_speed_mbps,
        uploadSpeedMbps: row.upload_speed_mbps,
        speedUnit: row.speed_unit,
        tvPlanCatalogId: row.tv_plan_catalog_id,
      })
    }
  }

  const tvPlanIds = [
    ...new Set(
      [...catalogById.values()]
        .map((item) => item.tvPlanCatalogId)
        .filter((id): id is string => Boolean(id))
    ),
  ]
  const tvPlanById = new Map<string, IspCustomer360ExportTvPlan>()
  for (const part of chunkIds(tvPlanIds)) {
    const { data, error } = await client
      .from("isp_service_catalog")
      .select("id, company_id, name, category")
      .eq("company_id", companyId)
      .in("id", part)
    if (error) throw new Error(error.message)
    for (const row of data ?? []) {
      tvPlanById.set(row.id, {
        id: row.id,
        companyId: row.company_id,
        name: row.name,
        category: row.category,
      })
    }
  }

  return buildIspCustomer360ExportRows({
    companyId,
    customers,
    subscriberDeletedAtByCustomerId,
    servicesByCustomerId,
    catalogById,
    tvPlanById,
  })
}
