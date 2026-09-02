import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  ABNET_DEBUG_EXPORT_HEADERS,
  abnetDebugExportFileName,
  buildAbnetDebugExportRows,
  isAbnetDebugExportActiveCustomer,
  mapAbnetDebugExportRow,
  resolveAbnetDebugPlanTv,
} from "../lib/customers/abnet-debug-export.ts"
import { isCommerciallyActiveCustomer } from "../lib/customers/customer-operational.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const COMPANY = "00000000-0000-4000-8000-000000000002"

function customer(overrides = {}) {
  return {
    id: "c1",
    customerNumber: "0001",
    name: "Juan Pérez",
    status: "activo",
    validationStatus: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

test("usa el mismo criterio de activos de /clientes y excluye baja", () => {
  assert.equal(isAbnetDebugExportActiveCustomer(customer()), true)
  assert.equal(isCommerciallyActiveCustomer(customer()), true)
  assert.equal(
    isAbnetDebugExportActiveCustomer(customer({ status: "inactivo" })),
    false
  )
  assert.equal(
    isAbnetDebugExportActiveCustomer(
      customer({ status: "pendiente-activacion" })
    ),
    false
  )
  assert.equal(
    isAbnetDebugExportActiveCustomer(customer({ validationStatus: "review" })),
    false
  )
  assert.equal(
    isAbnetDebugExportActiveCustomer(
      customer({ deletedAt: "2026-09-01T00:00:00.000Z" })
    ),
    false
  )
})

test("plan_tv sale del catálogo, no del nombre del servicio", () => {
  const catalogById = new Map([
    [
      "plan-50",
      {
        id: "plan-50",
        companyId: COMPANY,
        code: "FTTH-50",
        name: "FTTH 50 Megas + TV Basico - Pack Futbol",
        category: "internet",
        tvPlanCatalogId: null,
      },
    ],
    [
      "plan-300",
      {
        id: "plan-300",
        companyId: COMPANY,
        code: "FTTH-300",
        name: "Plan 300 Megas + TV Full",
        category: "internet",
        tvPlanCatalogId: "tv-full",
      },
    ],
  ])
  const tvPlanById = new Map([
    [
      "tv-full",
      {
        id: "tv-full",
        companyId: COMPANY,
        name: "TV Full",
        category: "tv",
      },
    ],
  ])
  assert.equal(
    resolveAbnetDebugPlanTv({
      catalog: catalogById.get("plan-50"),
      tvPlanById,
      companyId: COMPANY,
    }),
    ""
  )
  const withTv = mapAbnetDebugExportRow({
    companyId: COMPANY,
    customer: customer({ contractedPlan: "300Mb" }),
    services: [
      {
        customerId: "c1",
        catalogId: "plan-300",
        catalogCode: "FTTH-300",
        planName: "Plan 300 Megas + TV Full",
        commercialStatus: "active",
        createdAt: "2026-02-01T00:00:00.000Z",
        activationDate: "2026-02-01",
      },
    ],
    catalogById,
    tvPlanById,
  })
  assert.equal(withTv.contractedService, "Plan 300 Megas + TV Full")
  assert.equal(withTv.planTv, "TV Full")
  const withoutTv = mapAbnetDebugExportRow({
    companyId: COMPANY,
    customer: customer({ contractedPlan: "50Mb" }),
    services: [
      {
        customerId: "c1",
        catalogId: "plan-50",
        catalogCode: "FTTH-50",
        planName: "FTTH 50 Megas + TV Basico - Pack Futbol",
        commercialStatus: "active",
        createdAt: "2026-02-01T00:00:00.000Z",
        activationDate: "2026-02-01",
      },
    ],
    catalogById,
    tvPlanById,
  })
  assert.equal(withoutTv.planTv, "")
})

test("no pagina a 50 y no toca la UI de /clientes", () => {
  const script = read("scripts/export-clientes-abnet-debug.ts")
  const moduleUi = read("components/clientes/customers-module.tsx")
  const list = read("components/clientes/customers-list.tsx")
  const nav = read("lib/navigation/nav-items.ts")
  assert.match(script, /\.range\(from, to\)/)
  assert.match(script, /BESPOKE_PRODUCTION_COMPANY_ID/)
  assert.match(script, /\.eq\("company_id", companyId\)/)
  assert.doesNotMatch(script, /DEFAULT_CUSTOMER_PAGE_SIZE/)
  assert.doesNotMatch(moduleUi, /Exportar Excel/)
  assert.doesNotMatch(list, /Exportar Excel/)
  assert.doesNotMatch(nav, /export-clientes-abnet/)
  assert.ok(ABNET_DEBUG_EXPORT_HEADERS.includes("plan_tv"))
  assert.equal(
    abnetDebugExportFileName(new Date("2026-09-01T18:00:00.000-03:00")),
    "Clientes_ABNet_2026-09-01.xlsx"
  )
  const rows = buildAbnetDebugExportRows({
    companyId: COMPANY,
    customers: [
      customer({ id: "ok", name: "Ana" }),
      customer({ id: "baja", name: "Baja", status: "inactivo" }),
    ],
    servicesByCustomerId: new Map(),
    catalogById: new Map(),
    tvPlanById: new Map(),
  })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].fullName, "Ana")
})
