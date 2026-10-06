import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  buildOtPlanOptionsFromCatalog,
  catalogItemToContractedPlanCode,
  findCatalogItemForWorkOrder,
} from "../lib/isp/catalog-integrity.ts"
import {
  formatContractedPlanLabel,
  INTERNET_TV_BASICA_PLAN_CODES,
  INTERNET_TV_BASICA_PLAN_LABELS,
} from "../lib/tasks/commercial-plan.ts"
import { resolveFtthInstallationFromTask } from "../lib/tasks/ftth-installation.ts"

const root = resolve(import.meta.dirname, "..")
const migration = readFileSync(
  resolve(
    root,
    "supabase/migrations/20261231120000_abnet_internet_tv_basica_plans.sql"
  ),
  "utf8"
)

const HISTORICAL = ["20Mb", "50Mb", "100Mb", "300Mb"]

function catalogItem(overrides) {
  return {
    id: "cat",
    companyId: "abnet",
    code: null,
    name: "Plan",
    category: "internet",
    customerType: "residential",
    description: null,
    isActive: true,
    technology: "ftth",
    downloadSpeedMbps: 100,
    uploadSpeedMbps: 100,
    speedUnit: "mbps",
    monthlyPrice: 34800,
    currency: "ARS",
    priceIsConfigurable: true,
    billingPeriod: "monthly",
    billingMethod: "siro",
    requiresConnection: true,
    allowedConnectionTypes: ["pppoe"],
    technicalProfileId: null,
    tvPlanCatalogId: null,
    otLabel: "100 Mb",
    legacyPlanCode: "100Mb",
    isSeed: true,
    createdAt: "",
    updatedAt: "",
    ...overrides,
  }
}

const plans = [
  catalogItem({
    id: "hist-20",
    name: "Wireless 20 Mb",
    technology: "wireless",
    downloadSpeedMbps: 20,
    uploadSpeedMbps: 10,
    otLabel: "20 Mb Wireless",
    legacyPlanCode: "20Mb",
    code: "WIRELESS-20",
  }),
  catalogItem({
    id: "hist-50",
    name: "FTTH 50 Megas",
    technology: "ftth",
    downloadSpeedMbps: 50,
    uploadSpeedMbps: 50,
    otLabel: "50 Mb",
    legacyPlanCode: null,
    code: "FTTH-50",
  }),
  catalogItem({
    id: "hist-100",
    name: "FTTH 100 Megas",
    code: "FTTH-100",
    legacyPlanCode: "100Mb",
    otLabel: "100 Mb",
    downloadSpeedMbps: 100,
  }),
  catalogItem({
    id: "hist-300",
    name: "FTTH 300 Megas",
    code: "FTTH-300",
    legacyPlanCode: "300Mb",
    otLabel: "300 Mb",
    downloadSpeedMbps: 300,
  }),
  catalogItem({
    id: "tv-20",
    name: "20 Megas + TV Básica",
    code: "WIRELESS-20-TV-BASICO",
    technology: "wireless",
    downloadSpeedMbps: 20,
    uploadSpeedMbps: 10,
    monthlyPrice: 32800,
    otLabel: "20 Megas + TV Básica",
    legacyPlanCode: "WIRELESS-20-TV-BASICO",
  }),
  catalogItem({
    id: "tv-50",
    name: "50 Megas + TV Básica",
    code: "FTTH-50-TV-BASICO",
    downloadSpeedMbps: 50,
    uploadSpeedMbps: 50,
    monthlyPrice: 35300,
    otLabel: "50 Megas + TV Básica",
    legacyPlanCode: "FTTH-50-TV-BASICO",
  }),
  catalogItem({
    id: "tv-100",
    name: "100 Megas + TV Básica",
    code: "FTTH-100-TV-BASICO",
    downloadSpeedMbps: 100,
    monthlyPrice: 39300,
    otLabel: "100 Megas + TV Básica",
    legacyPlanCode: "FTTH-100-TV-BASICO",
  }),
  catalogItem({
    id: "tv-300",
    name: "300 Megas + TV Básica",
    code: "FTTH-300-TV-BASICO",
    downloadSpeedMbps: 300,
    monthlyPrice: 44300,
    otLabel: "300 Megas + TV Básica",
    legacyPlanCode: "FTTH-300-TV-BASICO",
  }),
]

test("migración solo inserta los 4 abonos de ABNet", () => {
  assert.match(migration, /00000000-0000-4000-8000-000000000002/)
  assert.match(migration, /INSERT INTO public\.isp_service_catalog/)
  assert.doesNotMatch(migration, /UPDATE public\.isp_service_catalog/)
  assert.doesNotMatch(migration, /UPDATE public\.tasks/)
  assert.doesNotMatch(migration, /UPDATE public\.customers/)
  assert.match(migration, /WHERE NOT EXISTS/)
  for (const code of INTERNET_TV_BASICA_PLAN_CODES) {
    assert.ok(migration.includes(code), code)
    assert.ok(migration.includes(INTERNET_TV_BASICA_PLAN_LABELS[code]), code)
  }
  assert.match(migration, /32800\.00/)
  assert.match(migration, /35300\.00/)
  assert.match(migration, /39300\.00/)
  assert.match(migration, /44300\.00/)
  assert.match(migration, /tv-basico/)
  assert.doesNotMatch(migration, /TV-BASICO-FUTBOL/)
  assert.doesNotMatch(migration, /TV-FULL/)
})

test("el selector distingue el abono nuevo del plan histórico de la misma velocidad", () => {
  const fiber = buildOtPlanOptionsFromCatalog(plans, "fiber")
  const wireless = buildOtPlanOptionsFromCatalog(plans, "wireless")

  assert.deepEqual(
    fiber.map((option) => option.label).sort(),
    [
      "50 Mb",
      "50 Megas + TV Básica",
      "100 Mb",
      "100 Megas + TV Básica",
      "300 Mb",
      "300 Megas + TV Básica",
    ].sort()
  )
  assert.deepEqual(
    wireless.map((option) => option.label).sort(),
    ["20 Mb Wireless", "20 Megas + TV Básica"].sort()
  )

  const fiberCodes = fiber.map((option) => option.contractedPlanCode)
  assert.ok(fiberCodes.includes("100Mb"))
  assert.ok(fiberCodes.includes("FTTH-100-TV-BASICO"))
  assert.equal(
    fiber.find((option) => option.catalogId === "tv-100")?.contractedPlanCode,
    "FTTH-100-TV-BASICO"
  )
  assert.equal(
    wireless.find((option) => option.catalogId === "tv-20")?.contractedPlanCode,
    "WIRELESS-20-TV-BASICO"
  )

  for (const historical of HISTORICAL) {
    assert.equal(
      fiber
        .concat(wireless)
        .filter((option) => option.contractedPlanCode === historical).length,
      1
    )
  }
})

test("una OT histórica sigue resolviendo al plan de Internet solo", () => {
  assert.equal(
    findCatalogItemForWorkOrder(plans, {
      otTechnology: "fiber",
      contractedPlan: "100Mb",
    })?.id,
    "hist-100"
  )
  assert.equal(
    findCatalogItemForWorkOrder(plans, {
      otTechnology: "fiber",
      contractedPlan: "50Mb",
    })?.id,
    "hist-50"
  )
  assert.equal(
    findCatalogItemForWorkOrder(plans, {
      otTechnology: "wireless",
      contractedPlan: "20Mb",
    })?.id,
    "hist-20"
  )
  assert.equal(
    findCatalogItemForWorkOrder(plans, {
      catalogId: "tv-100",
      otTechnology: "fiber",
      contractedPlan: "FTTH-100-TV-BASICO",
    })?.id,
    "tv-100"
  )
  assert.equal(
    catalogItemToContractedPlanCode(
      plans.find((item) => item.id === "tv-100")
    ),
    "FTTH-100-TV-BASICO"
  )
  assert.equal(formatContractedPlanLabel("100Mb"), "100 Mb")
  assert.equal(
    formatContractedPlanLabel("FTTH-100-TV-BASICO"),
    "100 Megas + TV Básica"
  )
  assert.equal(formatContractedPlanLabel("20Mb"), "20 Mb")
  assert.equal(
    formatContractedPlanLabel("WIRELESS-20-TV-BASICO"),
    "20 Megas + TV Básica"
  )
})

test("la ficha FTTH conserva el abono nuevo y los códigos históricos", () => {
  const task = {
    contractedPlan: "FTTH-50-TV-BASICO",
    taskMetadata: {},
    operationalSteps: [],
  }
  assert.equal(
    resolveFtthInstallationFromTask(task).contractedPlan,
    "FTTH-50-TV-BASICO"
  )
  assert.equal(
    resolveFtthInstallationFromTask({
      ...task,
      contractedPlan: "100Mb",
    }).contractedPlan,
    "100Mb"
  )
  assert.equal(
    resolveFtthInstallationFromTask({
      ...task,
      contractedPlan: "plan-desconocido",
    }).contractedPlan,
    ""
  )
})
