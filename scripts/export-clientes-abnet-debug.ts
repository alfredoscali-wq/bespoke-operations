import { mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { readFileSync } from "node:fs"

import ExcelJS from "exceljs"
import { createClient } from "@supabase/supabase-js"

import {
  ABNET_DEBUG_EXPORT_HEADERS,
  ABNET_DEBUG_EXPORT_SHEET_NAME,
  abnetDebugExportFileName,
  abnetDebugExportRowValues,
  buildAbnetDebugExportRows,
  type AbnetDebugCatalog,
  type AbnetDebugService,
  type AbnetDebugTvPlan,
} from "@/lib/customers/abnet-debug-export"
import { CUSTOMER_STATUS_PENDING_ACTIVATION } from "@/lib/customers/format"
import { resolveEffectiveCommercialStatus } from "@/lib/isp/subscriber-service-integrity"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import { mapCustomerRowToCustomer } from "@/lib/supabase/customers.mapper"
import type { Database } from "@/lib/supabase/database.types"

const PAGE_SIZE = 1000
const ID_CHUNK = 80

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local")
  const env = readFileSync(envPath, "utf8")
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim()
  const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim()
  if (!url || !key) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local")
  }
  return { url, key }
}

function chunkIds(ids: string[], size = ID_CHUNK): string[][] {
  const chunks: string[][] = []
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size))
  }
  return chunks
}

async function fetchAll<T>(
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

async function main() {
  const { url, key } = loadEnv()
  const companyId = BESPOKE_PRODUCTION_COMPANY_ID
  const client = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const customerRows = await fetchAll(async (from, to) => {
    const { data, error } = await client
      .from("customers")
      .select("*")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .eq("validation_status", "active")
      .neq("status", CUSTOMER_STATUS_PENDING_ACTIVATION)
      .neq("status", "inactivo")
      .order("id", { ascending: true })
      .range(from, to)
    if (error) throw new Error(error.message)
    return data ?? []
  })

  const customers = customerRows.map(mapCustomerRowToCustomer)
  const customerIds = customers.map((customer) => customer.id)

  const serviceRows = await fetchAll(async (from, to) => {
    const { data, error } = await client
      .from("isp_services")
      .select(
        "id, customer_id, catalog_id, catalog_code, plan_name, commercial_status, activation_date, created_at"
      )
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(from, to)
    if (error) throw new Error(error.message)
    return data ?? []
  })

  const servicesByCustomerId = new Map<string, AbnetDebugService[]>()
  const catalogIds = new Set<string>()
  const customerIdSet = new Set(customerIds)
  for (const row of serviceRows) {
    if (!customerIdSet.has(row.customer_id)) continue
    const service: AbnetDebugService = {
      customerId: row.customer_id,
      catalogId: row.catalog_id,
      catalogCode: row.catalog_code,
      planName: row.plan_name,
      commercialStatus: resolveEffectiveCommercialStatus({
        storedStatus: row.commercial_status,
        activationDate: row.activation_date,
      }),
      createdAt: row.created_at,
      activationDate: row.activation_date,
    }
    const current = servicesByCustomerId.get(row.customer_id) ?? []
    current.push(service)
    servicesByCustomerId.set(row.customer_id, current)
    if (row.catalog_id) catalogIds.add(row.catalog_id)
  }

  const catalogById = new Map<string, AbnetDebugCatalog>()
  for (const part of chunkIds([...catalogIds])) {
    const { data, error } = await client
      .from("isp_service_catalog")
      .select("id, company_id, code, name, category, tv_plan_catalog_id")
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
  const tvPlanById = new Map<string, AbnetDebugTvPlan>()
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

  const rows = buildAbnetDebugExportRows({
    companyId,
    customers,
    servicesByCustomerId,
    catalogById,
    tvPlanById,
  })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(ABNET_DEBUG_EXPORT_SHEET_NAME, {
    views: [{ state: "frozen", ySplit: 1, activeCell: "A2" }],
  })
  const header = sheet.addRow([...ABNET_DEBUG_EXPORT_HEADERS])
  header.font = { bold: true }
  for (const row of rows) {
    sheet.addRow(abnetDebugExportRowValues(row))
  }
  const lastRow = Math.max(sheet.rowCount, 1)
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: lastRow, column: ABNET_DEBUG_EXPORT_HEADERS.length },
  }
  sheet.columns.forEach((column, index) => {
    let max = ABNET_DEBUG_EXPORT_HEADERS[index]?.length ?? 12
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const length = cell.value == null ? 0 : String(cell.value).length
      if (length > max) max = length
    })
    column.width = Math.min(Math.max(max + 2, 12), 42)
  })

  const filename = abnetDebugExportFileName()
  const outDir = resolve(process.cwd(), "exports")
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, filename)
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
  writeFileSync(outPath, buffer)

  const withTv = rows.filter((row) => row.planTv).length
  const withCommercial = rows.filter((row) => row.commercialServiceName).length
  console.log(
    JSON.stringify(
      {
        file: outPath,
        filename,
        companyId,
        count: rows.length,
        withCommercialService: withCommercial,
        withPlanTv: withTv,
        columns: [...ABNET_DEBUG_EXPORT_HEADERS],
      },
      null,
      2
    )
  )
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
