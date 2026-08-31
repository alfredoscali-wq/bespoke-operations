/**
 * SERVICIOS 1.0 — TV component on commercial catalog services.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  assertTvPlanForCatalog,
  canCatalogItemIncludeTv,
  catalogItemHasTvComponent,
  catalogItemToDraft,
  catalogTvComponentListLabel,
  emptyCatalogDraft,
  ISP_CATALOG_TV_PLAN_CATEGORY_MESSAGE,
  ISP_CATALOG_TV_PLAN_CROSS_COMPANY_MESSAGE,
  ISP_CATALOG_TV_PLAN_REQUIRED_MESSAGE,
  ISP_CATALOG_TV_PLAN_SELF_MESSAGE,
  isSelectableTvCatalogPlan,
  resolveCommercialTvComponent,
  resolvedTvPlanCatalogId,
  snapshotServiceFromCatalog,
  validateCatalogDraft,
} from "../lib/isp/catalog-integrity.ts"
import { mapCatalogDraftToInsert } from "../lib/isp/catalog-mapper.ts"
import { ISP_CATALOG_SEED_ITEMS } from "../lib/isp/catalog-constants.ts"
import { ISP_MIGRATION_SERVICE_HEADERS } from "../lib/isp/migration/constants.ts"
import {
  TV_PLAN_CODES,
  TV_PLAN_NAMES,
  TV_PLAN_PRICES,
} from "../lib/subscriptions/tv-plans.ts"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

const migration = read(
  "supabase/migrations/20261204000100_servicios_1_0_tv_component.sql"
)
const catalogRls = read(
  "supabase/migrations/20261129000100_isp_1_1_catalogo_servicios.sql"
)
const form = read("components/isp/isp-catalog-form-screen.tsx")
const list = read("components/isp/isp-catalog-list-screen.tsx")
const detail = read("components/isp/isp-catalog-detail-screen.tsx")
const integrity = read("lib/isp/catalog-integrity.ts")
const mapper = read("lib/isp/catalog-mapper.ts")
const queries = read("lib/isp/catalog-queries.ts")
const customer360 = read("components/isp/isp-customer-detail-screen.tsx")
const serviceCard = read("components/isp/isp-service-card.tsx")
const subscriptionsQueries = read("lib/supabase/subscriptions.queries.ts")
const subscriptionsModule = read(
  "components/subscriptions/subscriptions-module.tsx"
)
const billingRun = read("lib/isp/billing-run-engine.ts")
const billingIntegrity = read("lib/isp/billing-integrity.ts")
const billingQueries = read("lib/isp/billing-queries.ts")

function commercialDraft(overrides = {}) {
  return {
    ...emptyCatalogDraft(),
    code: "FTTH-300-TV",
    name: "Plan 300 Megas + TV Full",
    category: "internet",
    monthlyPrice: "35000",
    ...overrides,
  }
}

function tvPlan(overrides = {}) {
  return {
    id: "tv-full-id",
    companyId: "co-1",
    code: TV_PLAN_CODES.FULL,
    name: TV_PLAN_NAMES[TV_PLAN_CODES.FULL],
    monthlyPrice: TV_PLAN_PRICES[TV_PLAN_CODES.FULL],
    isActive: true,
    category: "tv",
    ...overrides,
  }
}

const TV_PLANS = [
  {
    id: "tv-basico-id",
    code: TV_PLAN_CODES.BASICO,
    name: TV_PLAN_NAMES[TV_PLAN_CODES.BASICO],
    monthlyPrice: TV_PLAN_PRICES[TV_PLAN_CODES.BASICO],
  },
  {
    id: "tv-futbol-id",
    code: TV_PLAN_CODES.BASICO_FUTBOL,
    name: TV_PLAN_NAMES[TV_PLAN_CODES.BASICO_FUTBOL],
    monthlyPrice: TV_PLAN_PRICES[TV_PLAN_CODES.BASICO_FUTBOL],
  },
  {
    id: "tv-full-id",
    code: TV_PLAN_CODES.FULL,
    name: TV_PLAN_NAMES[TV_PLAN_CODES.FULL],
    monthlyPrice: TV_PLAN_PRICES[TV_PLAN_CODES.FULL],
  },
]

test("un servicio puede existir sin TV", () => {
  const draft = commercialDraft({
    name: "Plan 300 Megas",
    includesTv: false,
    tvPlanCatalogId: "",
  })
  assert.equal(validateCatalogDraft(draft).valid, true)
  assert.equal(resolvedTvPlanCatalogId(draft), null)
  assert.equal(mapCatalogDraftToInsert("co-1", draft).tv_plan_catalog_id, null)
  assert.equal(catalogItemHasTvComponent({ tvPlanCatalogId: null }), false)
  assert.equal(
    resolveCommercialTvComponent({
      actorCompanyId: "co-1",
      commercial: {
        id: "cat-300",
        companyId: "co-1",
        name: "Plan 300 Megas",
        monthlyPrice: 35000,
        tvPlanCatalogId: null,
      },
      tvPlan: null,
    }),
    null
  )
})

for (const plan of TV_PLANS) {
  test(`un servicio puede incluir ${plan.name}`, () => {
    const draft = commercialDraft({
      name: `Plan 300 Megas + ${plan.name}`,
      includesTv: true,
      tvPlanCatalogId: plan.id,
      monthlyPrice: "35000",
    })
    assert.equal(validateCatalogDraft(draft).valid, true)
    const insert = mapCatalogDraftToInsert("co-1", draft)
    assert.equal(insert.tv_plan_catalog_id, plan.id)
    assert.equal(insert.monthly_price, 35000)
    assert.notEqual(insert.monthly_price, plan.monthlyPrice)

    const resolved = resolveCommercialTvComponent({
      actorCompanyId: "co-1",
      commercial: {
        id: "cat-300",
        companyId: "co-1",
        name: draft.name,
        monthlyPrice: 35000,
        tvPlanCatalogId: plan.id,
      },
      tvPlan: tvPlan(plan),
    })
    assert.ok(resolved)
    assert.equal(resolved.tvPlanCatalogId, plan.id)
    assert.equal(resolved.tvPlanCode, plan.code)
    assert.equal(resolved.tvPlanName, plan.name)
    assert.equal(resolved.tvMonthlyPrice, plan.monthlyPrice)
    assert.equal(resolved.commercialMonthlyPrice, 35000)
  })
}

test("la relación apunta al catálogo TV real, no al nombre comercial", () => {
  const draft = commercialDraft({
    includesTv: true,
    tvPlanCatalogId: "tv-full-id",
  })
  const insert = mapCatalogDraftToInsert("co-1", draft)
  assert.equal(insert.tv_plan_catalog_id, "tv-full-id")
  assert.notEqual(insert.tv_plan_catalog_id, "TV Full")
  assert.equal(insert.name, "Plan 300 Megas + TV Full")
  assert.match(mapper, /tv_plan_catalog_id: resolvedTvPlanCatalogId/)
  assert.match(queries, /tv_plan_catalog_id: insert\.tv_plan_catalog_id/)
  assert.doesNotMatch(integrity, /name\.includes\(["'`]TV/)
  assert.doesNotMatch(form, /name\.includes\(["'`]TV/)
  assert.doesNotMatch(queries, /name\.includes\(["'`]TV/)
})

test("no se pueden seleccionar servicios de Internet como plan TV", () => {
  const internet = {
    id: "inet-1",
    category: "internet",
    isActive: true,
  }
  assert.equal(isSelectableTvCatalogPlan(internet), false)
  assert.equal(
    isSelectableTvCatalogPlan({ id: "tv-full-id", category: "tv", isActive: true }),
    true
  )
  assert.equal(
    assertTvPlanForCatalog({
      companyId: "co-1",
      selectedTvPlanId: "inet-1",
      tvPlan: tvPlan({ id: "inet-1", category: "internet" }),
    }).message,
    ISP_CATALOG_TV_PLAN_CATEGORY_MESSAGE
  )
  assert.match(form, /isSelectableTvCatalogPlan/)
  assert.match(form, /category=tv/)
  assert.match(migration, /El componente TV debe ser un plan de categoría TV/)
})

test("el precio del componente TV proviene del catálogo TV y el abono es independiente", () => {
  const item = {
    id: "cat-300",
    companyId: "co-1",
    code: "FTTH-300-TV",
    name: "Plan 300 Megas + TV Full",
    category: "internet",
    customerType: "residential",
    description: null,
    isActive: true,
    technology: "ftth",
    downloadSpeedMbps: 300,
    uploadSpeedMbps: null,
    speedUnit: "mbps",
    monthlyPrice: 35000,
    currency: "ARS",
    priceIsConfigurable: true,
    billingPeriod: "monthly",
    billingMethod: "siro",
    requiresConnection: true,
    allowedConnectionTypes: ["pppoe"],
    technicalProfileId: null,
    tvPlanCatalogId: "tv-full-id",
    tvPlan: tvPlan(),
    otLabel: "300 Mb",
    legacyPlanCode: null,
    isSeed: false,
    createdAt: "2026-08-31T00:00:00.000Z",
    updatedAt: "2026-08-31T00:00:00.000Z",
  }
  const draft = catalogItemToDraft(item)
  assert.equal(draft.monthlyPrice, "35000")
  assert.equal(item.tvPlan.monthlyPrice, 9900)
  const snapshot = snapshotServiceFromCatalog(item)
  assert.equal(snapshot.planName, "Plan 300 Megas + TV Full")
  assert.equal(snapshot.monthlyFee, "35000")
  assert.notEqual(snapshot.monthlyFee, "9900")
})

test("cambiar el nombre del servicio no cambia el componente TV", () => {
  const withTv = commercialDraft({
    name: "Plan 300 Megas + TV Full",
    includesTv: true,
    tvPlanCatalogId: "tv-full-id",
  })
  const renamed = commercialDraft({
    name: "Abono Fibra 300 con televisión",
    includesTv: true,
    tvPlanCatalogId: "tv-full-id",
  })
  assert.equal(
    mapCatalogDraftToInsert("co-1", withTv).tv_plan_catalog_id,
    mapCatalogDraftToInsert("co-1", renamed).tv_plan_catalog_id
  )
  assert.equal(mapCatalogDraftToInsert("co-1", renamed).name, renamed.name)
})

test("incluye TV exige un plan del catálogo", () => {
  const result = validateCatalogDraft(
    commercialDraft({ includesTv: true, tvPlanCatalogId: "" })
  )
  assert.equal(result.valid, false)
  assert.equal(result.message, ISP_CATALOG_TV_PLAN_REQUIRED_MESSAGE)
})

test("un plan de categoría TV no puede incluir otro componente TV", () => {
  assert.equal(canCatalogItemIncludeTv("tv"), false)
  assert.equal(canCatalogItemIncludeTv("internet"), true)
  const draft = commercialDraft({
    category: "tv",
    includesTv: true,
    tvPlanCatalogId: "tv-full-id",
  })
  assert.equal(resolvedTvPlanCatalogId(draft), null)
  assert.equal(mapCatalogDraftToInsert("co-1", draft).tv_plan_catalog_id, null)
})

test("la relación respeta company_id en app y en la base", () => {
  assert.equal(
    assertTvPlanForCatalog({
      companyId: "co-1",
      selectedTvPlanId: "tv-full-id",
      tvPlan: tvPlan({ companyId: "co-2" }),
    }).message,
    ISP_CATALOG_TV_PLAN_CROSS_COMPANY_MESSAGE
  )
  assert.equal(
    resolveCommercialTvComponent({
      actorCompanyId: "co-1",
      commercial: {
        id: "cat-300",
        companyId: "co-1",
        name: "Plan 300 Megas + TV Full",
        monthlyPrice: 35000,
        tvPlanCatalogId: "tv-full-id",
      },
      tvPlan: tvPlan({ companyId: "co-2" }),
    }),
    null
  )
  assert.equal(
    assertTvPlanForCatalog({
      companyId: "co-1",
      catalogId: "cat-300",
      selectedTvPlanId: "cat-300",
      tvPlan: tvPlan({ id: "cat-300" }),
    }).message,
    ISP_CATALOG_TV_PLAN_SELF_MESSAGE
  )
  assert.match(migration, /plan TV de otra empresa/)
  assert.match(migration, /SECURITY DEFINER/)
  assert.match(catalogRls, /company_id = public\.auth_user_company_id\(\)/)
  assert.match(queries, /assertTvPlanForCatalog/)
})

test("servicios existentes sin TV continúan funcionando", () => {
  const draft = {
    ...emptyCatalogDraft(),
    code: "FTTH-300",
    name: "FTTH 300 Mb",
    technology: "ftth",
  }
  assert.equal(validateCatalogDraft(draft).valid, true)
  assert.equal(mapCatalogDraftToInsert("co-1", draft).tv_plan_catalog_id, null)
  assert.ok(ISP_CATALOG_SEED_ITEMS.some((item) => item.code === "FTTH-300"))
  assert.ok(ISP_CATALOG_SEED_ITEMS.every((item) => !("tvPlanCatalogId" in item)))
  assert.match(migration, /Existing rows without TV stay NULL/)
  assert.doesNotMatch(migration, /ALTER TABLE public\.isp_services/)
})

test("Clientes 360 sigue mostrando el servicio comercial, sin descomponer Internet/TV", () => {
  assert.match(serviceCard, /service\.planName/)
  assert.match(customer360, /service\.planName/)
  assert.doesNotMatch(serviceCard, /tvPlan|Componente TV|Internet:/)
  assert.doesNotMatch(customer360, /tvPlanCatalogId|Componente TV/)
})

test("la relación estructurada permite consultar el componente TV desde el servicio comercial", () => {
  const resolved = resolveCommercialTvComponent({
    actorCompanyId: "co-1",
    commercial: {
      id: "cat-300",
      companyId: "co-1",
      name: "Plan 300 Megas + TV Full",
      monthlyPrice: 35000,
      tvPlanCatalogId: "tv-full-id",
    },
    tvPlan: tvPlan(),
  })
  assert.equal(resolved?.tvPlanName, "TV Full")
  assert.equal(resolved?.tvMonthlyPrice, 9900)
  assert.match(migration, /isp_services\.catalog_id/)
  assert.match(subscriptionsQueries, /tv_plan_catalog_id/)
})

test("no se modifica facturación ni SIRO: un solo abono comercial", () => {
  assert.doesNotMatch(billingRun, /tv_plan_catalog_id/)
  assert.doesNotMatch(billingIntegrity, /tv_plan_catalog_id/)
  assert.doesNotMatch(billingQueries, /tv_plan_catalog_id/)
  assert.match(billingRun, /serviceName: input\.service\.planName/)
  assert.match(billingRun, /monthlyFee: service\.monthlyFee/)
  assert.doesNotMatch(migration, /ALTER TABLE public\.isp_billing/)
  assert.doesNotMatch(
    read("lib/isp/billing-run-engine.ts"),
    /TV Full|componente TV/
  )
})

test("migración: FK opcional al catálogo TV, sin tabla nueva", () => {
  assert.match(migration, /tv_plan_catalog_id/)
  assert.match(migration, /REFERENCES public\.isp_service_catalog/)
  assert.match(migration, /category IS DISTINCT FROM 'tv'/)
  assert.doesNotMatch(migration, /CREATE TABLE/)
})

test("UX: sección componente TV, selector de planes TV y listado", () => {
  assert.match(form, /Componente TV/)
  assert.match(form, /Este servicio incluye TV/)
  assert.match(form, /No es el precio total del servicio/)
  assert.match(form, /Cargo TV \(referencia\)/)
  assert.match(list, /catalogTvComponentListLabel/)
  assert.match(detail, /Componente TV/)
  assert.match(detail, /Sin TV/)
  assert.equal(catalogTvComponentListLabel(tvPlan()), "Full")
  assert.equal(catalogTvComponentListLabel(null), "—")
})

test("el Excel de importación no agrega plan_tv en este sprint", () => {
  assert.equal(ISP_MIGRATION_SERVICE_HEADERS.includes("plan_tv"), false)
  assert.doesNotMatch(read("lib/isp/migration/constants.ts"), /plan_tv/)
  assert.doesNotMatch(read("lib/isp/migration/parse.ts"), /tv_plan_catalog_id/)
})
