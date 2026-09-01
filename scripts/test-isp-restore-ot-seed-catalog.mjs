/**
 * Restore FTTH 50/100/300 and Wireless 20 catalog plans used by new-installation OTs.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  ISP_CATALOG_SEED_ITEMS,
  isOtRequiredSeedCatalogItem,
} from "../lib/isp/catalog-constants.ts"
import {
  canDeleteCatalogItemFromServicios,
  ISP_OT_REQUIRED_CATALOG_CANNOT_DELETE_MESSAGE,
} from "../lib/isp/catalog-integrity.ts"
import {
  buildOtPlanOptionsFromCatalog,
} from "../lib/isp/catalog-integrity.ts"

const root = resolve(import.meta.dirname, "..")
const sql = readFileSync(
  resolve(root, "supabase/migrations/20261209000100_isp_restore_ot_seed_catalog.sql"),
  "utf8"
)
const queries = readFileSync(resolve(root, "lib/isp/catalog-queries.ts"), "utf8")
const importer = readFileSync(
  resolve(root, "lib/isp/migration/tv-component.ts"),
  "utf8"
)
const subscriptions = readFileSync(
  resolve(root, "components/subscriptions/subscriptions-module.tsx"),
  "utf8"
)
const technologyFields = readFileSync(
  resolve(root, "components/tareas/work-order-technology-plan-fields.tsx"),
  "utf8"
)

test("la migración reactiva o reinserta los 4 planes de OT", () => {
  for (const code of ["FTTH-50", "FTTH-100", "FTTH-300", "WIRELESS-20"]) {
    assert.match(sql, new RegExp(code))
  }
  for (const legacy of ["50Mb", "100Mb", "300Mb", "20Mb"]) {
    assert.match(sql, new RegExp(`'${legacy}'`))
  }
  assert.match(sql, /deleted_at = NULL/)
  assert.match(sql, /is_active = true/)
  assert.match(sql, /INSERT INTO public\.isp_service_catalog/)
  assert.doesNotMatch(sql, /ON DELETE CASCADE/)
  assert.doesNotMatch(sql, /monthly_price =/)
})

test("no toca importador, TV, billing ni /subscriptions", () => {
  assert.doesNotMatch(sql, /subscription_/)
  assert.doesNotMatch(sql, /isp_billing/)
  assert.doesNotMatch(importer, /20261209000100/)
  assert.doesNotMatch(subscriptions, /20261209000100/)
})

test("Fibra muestra 50/100/300 y Wireless solo 20 Mb", () => {
  assert.deepEqual(
    ISP_CATALOG_SEED_ITEMS.filter((item) => item.technology === "ftth").map(
      (item) => item.legacyPlanCode
    ),
    ["50Mb", "100Mb", "300Mb"]
  )
  assert.deepEqual(
    ISP_CATALOG_SEED_ITEMS.filter((item) => item.technology === "wireless").map(
      (item) => item.legacyPlanCode
    ),
    ["20Mb"]
  )
  const catalog = ISP_CATALOG_SEED_ITEMS.map((item, index) => ({
    id: `cat-${index}`,
    companyId: "co-1",
    code: item.code,
    name: item.name,
    category: "internet",
    customerType: "residential",
    description: null,
    isActive: true,
    technology: item.technology,
    downloadSpeedMbps: item.downloadSpeedMbps,
    uploadSpeedMbps: null,
    speedUnit: "mbps",
    monthlyPrice: null,
    currency: "ARS",
    priceIsConfigurable: true,
    billingPeriod: "monthly",
    billingMethod: "siro",
    requiresConnection: true,
    allowedConnectionTypes: [...item.allowedConnectionTypes],
    technicalProfileId: null,
    otLabel: item.otLabel,
    legacyPlanCode: item.legacyPlanCode,
    isSeed: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    usedCount: 0,
  }))
  assert.deepEqual(
    buildOtPlanOptionsFromCatalog(catalog, "fiber").map(
      (option) => option.contractedPlanCode
    ),
    ["50Mb", "100Mb", "300Mb"]
  )
  assert.deepEqual(
    buildOtPlanOptionsFromCatalog(catalog, "wireless").map(
      (option) => option.contractedPlanCode
    ),
    ["20Mb"]
  )
})

test("la OT wireless pide IP de instalación", () => {
  assert.match(technologyFields, /isWireless/)
  assert.match(technologyFields, /IP de Instalación/)
  assert.match(technologyFields, /installationIp/)
})

test("no se pueden volver a eliminar del catálogo", () => {
  const blocked = canDeleteCatalogItemFromServicios({
    code: "FTTH-100",
    legacyPlanCode: "100Mb",
  })
  assert.equal(blocked.allowed, false)
  assert.equal(blocked.message, ISP_OT_REQUIRED_CATALOG_CANNOT_DELETE_MESSAGE)
  assert.equal(
    canDeleteCatalogItemFromServicios({ code: "EMP-DEDICADO" }).allowed,
    true
  )
  assert.equal(isOtRequiredSeedCatalogItem({ code: "WIRELESS-20" }), true)
  assert.match(queries, /canDeleteCatalogItemFromServicios/)
})
