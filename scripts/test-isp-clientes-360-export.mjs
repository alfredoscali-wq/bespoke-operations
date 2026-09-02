import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
import * as XLSX from "xlsx"

import {
  ISP_CUSTOMER_360_EXPORT_HEADERS,
  buildIspCustomer360ExportRows,
  compareIspCustomer360ExportRows,
  ispCustomer360ExportFileName,
  isActiveIspCustomer360Export,
  mapIspCustomer360ExportRow,
  resolveIspExportTvPlanName,
  splitIspCustomerName,
} from "../lib/isp/customer-360-export.ts"
import { buildIspCustomer360ExportWorkbook } from "../lib/isp/customer-360-export-xlsx.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const COMPANY_A = "00000000-0000-4000-8000-000000000002"
const COMPANY_B = "00000000-0000-4000-8000-000000000099"
const TV_BASICO_ID = "tv-basico"
const TV_FUTBOL_ID = "tv-futbol"
const PLAN_300_ID = "plan-300"
const PLAN_50_TV_ID = "plan-50-tv"

function customer(overrides = {}) {
  return {
    id: "c1",
    companyId: COMPANY_A,
    name: "Juan Pérez",
    dni: "20123456",
    phone: "3515550000",
    whatsapp: "3515550000",
    email: "juan@test.com",
    address: "San Martín 100",
    locality: "Córdoba",
    status: "activo",
    createdAt: "2026-01-15T12:00:00.000Z",
    customerNumber: "1001",
    externalCustomerCode: "ABN-1001",
    statusReason: null,
    deletedAt: null,
    ...overrides,
  }
}

function service(overrides = {}) {
  return {
    customerId: "c1",
    catalogId: PLAN_300_ID,
    catalogCode: "FTTH-300",
    planName: "Plan 300 Megas + TV Full",
    technology: "ftth",
    downloadSpeed: 300,
    uploadSpeed: 300,
    speedUnit: "mbps",
    monthlyFee: 44300,
    commercialStatus: "active",
    monthlyCollectionMethod: "siro",
    activationDate: "2026-02-01",
    notes: null,
    createdAt: "2026-02-01T12:00:00.000Z",
    ...overrides,
  }
}

function catalogs() {
  const catalogById = new Map()
  catalogById.set(PLAN_300_ID, {
    id: PLAN_300_ID,
    companyId: COMPANY_A,
    code: "FTTH-300",
    name: "Plan 300 Megas + TV Full",
    category: "internet",
    technology: "ftth",
    downloadSpeedMbps: 300,
    uploadSpeedMbps: 300,
    speedUnit: "mbps",
    tvPlanCatalogId: "tv-full",
  })
  catalogById.set(PLAN_50_TV_ID, {
    id: PLAN_50_TV_ID,
    companyId: COMPANY_A,
    code: "FTTH-50-FUTBOL",
    name: "FTTH 50 Megas + TV Basico - Pack Futbol",
    category: "internet",
    technology: "ftth",
    downloadSpeedMbps: 50,
    uploadSpeedMbps: 50,
    speedUnit: "mbps",
    tvPlanCatalogId: TV_FUTBOL_ID,
  })
  catalogById.set("plan-50", {
    id: "plan-50",
    companyId: COMPANY_A,
    code: "FTTH-50",
    name: "FTTH 50 Megas",
    category: "internet",
    technology: "ftth",
    downloadSpeedMbps: 50,
    uploadSpeedMbps: 50,
    speedUnit: "mbps",
    tvPlanCatalogId: null,
  })
  const tvPlanById = new Map()
  tvPlanById.set("tv-full", {
    id: "tv-full",
    companyId: COMPANY_A,
    name: "TV Full",
    category: "tv",
  })
  tvPlanById.set(TV_FUTBOL_ID, {
    id: TV_FUTBOL_ID,
    companyId: COMPANY_A,
    name: "TV Básico + Pack Fútbol",
    category: "tv",
  })
  tvPlanById.set(TV_BASICO_ID, {
    id: TV_BASICO_ID,
    companyId: COMPANY_A,
    name: "TV Básico",
    category: "tv",
  })
  return { catalogById, tvPlanById }
}

test("exporta solo clientes activos de Clientes 360", () => {
  assert.equal(
    isActiveIspCustomer360Export({
      companyId: COMPANY_A,
      customer: customer(),
      subscriberDeletedAt: null,
      commercialStatuses: ["active"],
    }),
    true
  )
  assert.equal(
    isActiveIspCustomer360Export({
      companyId: COMPANY_A,
      customer: customer({ status: "inactivo" }),
      subscriberDeletedAt: null,
      commercialStatuses: ["active"],
    }),
    false
  )
  assert.equal(
    isActiveIspCustomer360Export({
      companyId: COMPANY_A,
      customer: customer(),
      subscriberDeletedAt: null,
      commercialStatuses: ["suspended"],
    }),
    false
  )
  assert.equal(
    isActiveIspCustomer360Export({
      companyId: COMPANY_A,
      customer: customer({ status: "pendiente-activacion" }),
      subscriberDeletedAt: null,
      commercialStatuses: ["active"],
    }),
    false
  )
  assert.equal(
    isActiveIspCustomer360Export({
      companyId: COMPANY_A,
      customer: customer({ deletedAt: "2026-09-01T00:00:00.000Z" }),
      subscriberDeletedAt: null,
      commercialStatuses: ["active"],
    }),
    false
  )
  assert.equal(
    isActiveIspCustomer360Export({
      companyId: COMPANY_A,
      customer: customer(),
      subscriberDeletedAt: "2026-09-01T00:00:00.000Z",
      commercialStatuses: ["active"],
    }),
    false
  )
})

test("no exporta clientes de otra empresa", () => {
  assert.equal(
    isActiveIspCustomer360Export({
      companyId: COMPANY_A,
      customer: customer({ companyId: COMPANY_B }),
      subscriberDeletedAt: null,
      commercialStatuses: ["active"],
    }),
    false
  )
})

test("incluye el nombre comercial y el Plan TV del catálogo", () => {
  const { catalogById, tvPlanById } = catalogs()
  const row = mapIspCustomer360ExportRow({
    companyId: COMPANY_A,
    customer: customer(),
    services: [service()],
    catalogById,
    tvPlanById,
  })
  assert.equal(row.contractedService, "Plan 300 Megas + TV Full")
  assert.equal(row.serviceCode, "FTTH-300")
  assert.equal(row.tvPlan, "TV Full")
  assert.equal(row.tvStatus, "Activo")
  assert.equal(row.subscriberNumber, "ABN-1001")
  assert.equal(row.firstName, "Juan")
  assert.equal(row.lastName, "Pérez")
  assert.equal(row.street, "San Martín")
  assert.equal(row.streetNumber, "100")
})

test("Plan TV sale del catálogo, no del nombre del servicio", () => {
  const { catalogById, tvPlanById } = catalogs()
  assert.equal(
    resolveIspExportTvPlanName({
      catalog: catalogById.get(PLAN_50_TV_ID),
      tvPlanById,
      companyId: COMPANY_A,
    }),
    "TV Básico + Pack Fútbol"
  )
  const withoutTv = mapIspCustomer360ExportRow({
    companyId: COMPANY_A,
    customer: customer(),
    services: [
      service({
        catalogId: "plan-50",
        catalogCode: "FTTH-50",
        planName: "FTTH 50 Megas + TV Basico - Pack Futbol",
      }),
    ],
    catalogById,
    tvPlanById,
  })
  assert.equal(withoutTv.contractedService, "FTTH 50 Megas")
  assert.equal(withoutTv.tvPlan, "")
  assert.equal(withoutTv.tvStatus, "")
})

test("clientes sin TV dejan la columna vacía", () => {
  const { catalogById, tvPlanById } = catalogs()
  const row = mapIspCustomer360ExportRow({
    companyId: COMPANY_A,
    customer: customer(),
    services: [service({ catalogId: "plan-50", planName: "FTTH 50 Megas" })],
    catalogById,
    tvPlanById,
  })
  assert.equal(row.tvPlan, "")
})

test("exporta todos los activos y no usa la paginación de 400", () => {
  const queries = read("lib/isp/customer-360-export-queries.ts")
  const listQueries = read("lib/isp/queries.ts")
  assert.match(queries, /listActiveIspCustomersForExcelExport/)
  assert.match(queries, /\.range\(from, to\)/)
  assert.doesNotMatch(queries, /slice\(0, 400\)/)
  assert.match(listQueries, /slice\(0, 400\)/)
  assert.match(queries, /\.eq\("company_id", companyId\)/)

  const { catalogById, tvPlanById } = catalogs()
  const customers = Array.from({ length: 3 }, (_, index) =>
    customer({
      id: `c${index}`,
      name: `Cliente ${index}`,
      externalCustomerCode: `ABN-${1000 + index}`,
    })
  )
  customers.push(
    customer({
      id: "suspended",
      name: "Suspendido",
      status: "activo",
      externalCustomerCode: "ABN-0001",
    })
  )
  const servicesByCustomerId = new Map()
  for (const item of customers) {
    servicesByCustomerId.set(item.id, [
      service({
        customerId: item.id,
        commercialStatus: item.id === "suspended" ? "suspended" : "active",
      }),
    ])
  }
  const rows = buildIspCustomer360ExportRows({
    companyId: COMPANY_A,
    customers,
    subscriberDeletedAtByCustomerId: new Map(
      customers.map((item) => [item.id, null])
    ),
    servicesByCustomerId,
    catalogById,
    tvPlanById,
  })
  assert.equal(rows.length, 3)
  assert.equal(rows[0].subscriberNumber, "ABN-1000")
  assert.equal(rows[1].subscriberNumber, "ABN-1001")
  assert.equal(rows[2].subscriberNumber, "ABN-1002")
})

test("ordena por número de abonado y luego por nombre", () => {
  const ordered = [
    { subscriberNumber: "20", firstName: "B", lastName: "" },
    { subscriberNumber: "3", firstName: "A", lastName: "" },
    { subscriberNumber: "", firstName: "Zeta", lastName: "" },
    { subscriberNumber: "", firstName: "Ana", lastName: "" },
  ].sort(compareIspCustomer360ExportRows)
  assert.deepEqual(
    ordered.map((row) => row.subscriberNumber || row.firstName),
    ["3", "20", "Ana", "Zeta"]
  )
})

test("el archivo xlsx abre, congela encabezados y tiene filtros", async () => {
  const { catalogById, tvPlanById } = catalogs()
  const row = mapIspCustomer360ExportRow({
    companyId: COMPANY_A,
    customer: customer(),
    services: [service()],
    catalogById,
    tvPlanById,
  })
  const buffer = await buildIspCustomer360ExportWorkbook([row])
  const workbook = XLSX.read(buffer, { type: "buffer", cellStyles: true })
  const sheet = workbook.Sheets.Clientes
  assert.ok(sheet)
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1 })
  assert.deepEqual(matrix[0], [...ISP_CUSTOMER_360_EXPORT_HEADERS])
  assert.equal(matrix[1][15], "Plan 300 Megas + TV Full")
  assert.equal(matrix[1][20], "TV Full")
  assert.equal(sheet["!autofilter"]?.ref?.startsWith("A1:"), true)
  const freeze =
    sheet["!freeze"] ?? sheet["!views"]?.[0] ?? workbook.Workbook?.Views?.[0]
  assert.ok(freeze)
})

test("nombre de archivo y botón de exportar", () => {
  const filename = ispCustomer360ExportFileName(
    new Date("2026-09-01T18:00:00.000-03:00")
  )
  assert.equal(filename, "Clientes360_ABNet_2026-09-01.xlsx")
  const list = read("components/isp/isp-customer-list-screen.tsx")
  const route = read("app/api/isp/customers/export/route.ts")
  const importer = read("lib/isp/migration/parse.ts")
  const template = read("lib/isp/migration/template.ts")
  assert.match(list, /Exportar Excel/)
  assert.match(list, /<Download /)
  assert.match(list, /\/api\/isp\/customers\/export/)
  assert.match(route, /listActiveIspCustomersForExcelExport/)
  assert.match(route, /requireIspReadContext/)
  assert.doesNotMatch(importer, /listActiveIspCustomersForExcelExport/)
  assert.doesNotMatch(template, /listActiveIspCustomersForExcelExport/)
  assert.equal(splitIspCustomerName("Pérez, Juan Carlos").firstName, "Juan Carlos")
  assert.equal(splitIspCustomerName("Pérez, Juan Carlos").lastName, "Pérez")
})
