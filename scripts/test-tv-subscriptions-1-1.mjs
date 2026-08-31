/**
 * TV & Suscripciones 1.1 — dynamic TV catalog + KPIs from commercial component.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { isSelectableTvCatalogPlan } from "../lib/isp/catalog-integrity.ts"
import {
  canChangeTvPlanCode,
  TV_PLAN_INTERNET_FORBIDDEN_MESSAGE,
  TV_PLAN_PRICE_INVALID_MESSAGE,
  tvPlanWriteDraftToCatalogDraft,
  validateTvPlanWriteDraft,
} from "../lib/subscriptions/tv-catalog.ts"
import {
  isCountableTvService,
  isTvCatalogCategory,
  serviceMatchesSelectedPlan,
  summarizeTvPlans,
  TV_PLAN_CODES,
  TV_PLAN_NAMES,
  TV_PLAN_PRICES,
  tvPlanRevenue,
} from "../lib/subscriptions/tv-plans.ts"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

const queries = read("lib/supabase/subscriptions.queries.ts")
const ui = read("components/subscriptions/subscriptions-module.tsx")
const cards = read("components/subscriptions/subscriptions-summary-cards.tsx")
const catalogUi = read("components/subscriptions/tv-plans-catalog-section.tsx")
const form = read("components/isp/isp-catalog-form-screen.tsx")
const customer360 = read("components/isp/isp-customer-detail-screen.tsx")
const serviceCard = read("components/isp/isp-service-card.tsx")
const rls = read(
  "supabase/migrations/20261205000100_tv_subscriptions_1_1_catalog_rls.sql"
)
const tvComponent = read(
  "supabase/migrations/20261204000100_servicios_1_0_tv_component.sql"
)
const seed = read(
  "supabase/migrations/20261203000100_tv_subscriptions_1_0.sql"
)

test("los planes TV se obtienen dinámicamente del catálogo, no de una lista fija", () => {
  assert.match(queries, /\.eq\("category", "tv"\)/)
  assert.doesNotMatch(queries, /isTvPlanCode\(row\.code\)/)
  assert.doesNotMatch(cards, /TV_PLAN_CODES/)
  assert.doesNotMatch(cards, /TV_PLAN_NAMES/)
  assert.match(cards, /plans\.map/)
  assert.match(cards, /setSelectedPlan\(plan\.catalogId\)/)
  assert.doesNotMatch(ui, /TV_PLAN_NAMES\[/)

  const premium = summarizeTvPlans([
    {
      code: "TV-PREMIUM",
      catalogId: "tv-premium",
      name: "TV Premium",
      monthlyPrice: 12500,
      activeCount: 0,
    },
  ])
  assert.equal(premium.plans.length, 1)
  assert.equal(premium.plans[0].name, "TV Premium")
  assert.equal(premium.plans[0].activeCount, 0)
  assert.equal(premium.plans[0].monthlyRevenue, 0)
})

test("TV Básico, Básico + Fútbol y Full aparecen desde el catálogo seed", () => {
  assert.equal(TV_PLAN_NAMES[TV_PLAN_CODES.BASICO], "TV Básico")
  assert.equal(
    TV_PLAN_NAMES[TV_PLAN_CODES.BASICO_FUTBOL],
    "TV Básico + Pack Fútbol"
  )
  assert.equal(TV_PLAN_NAMES[TV_PLAN_CODES.FULL], "TV Full")
  assert.match(seed, /'TV-BASICO'/)
  assert.match(seed, /'TV-BASICO-FUTBOL'/)
  assert.match(seed, /'TV-FULL'/)
  assert.doesNotMatch(seed, /CREATE TABLE public\.tv_/)
})

test("un plan inactivo no aparece como opción para nuevos servicios y no rompe existentes", () => {
  assert.equal(
    isSelectableTvCatalogPlan({
      id: "tv-full",
      category: "tv",
      isActive: false,
    }),
    false
  )
  assert.equal(
    isSelectableTvCatalogPlan(
      { id: "tv-full", category: "tv", isActive: false },
      { selectedTvPlanId: "tv-full" }
    ),
    true
  )
  assert.match(form, /isSelectableTvCatalogPlan/)
  assert.equal(canChangeTvPlanCode(0), true)
  assert.equal(canChangeTvPlanCode(2), false)
})

test("los planes pertenecen al company_id y no se mezclan tenants ni Internet", () => {
  assert.match(queries, /\.eq\("company_id", companyId\)/)
  assert.match(rls, /auth_user_company_id\(\)/)
  assert.match(rls, /category = 'tv'/)
  assert.equal(
    isSelectableTvCatalogPlan({
      id: "inet-1",
      category: "internet",
      isActive: true,
    }),
    false
  )
  const internetDraft = tvPlanWriteDraftToCatalogDraft({
    name: "FTTH 300",
    code: "FTTH-300",
    monthlyPrice: "35000",
    isActive: true,
  })
  assert.equal(internetDraft.category, "tv")
  assert.equal(internetDraft.requiresConnection, false)
  assert.equal(TV_PLAN_INTERNET_FORBIDDEN_MESSAGE.includes("Internet"), true)
})

test("el KPI usa precio del catálogo y cantidad × precio TV, sin Internet", () => {
  const summary = summarizeTvPlans([
    {
      code: TV_PLAN_CODES.BASICO,
      catalogId: "c1",
      name: "TV Básico",
      monthlyPrice: TV_PLAN_PRICES[TV_PLAN_CODES.BASICO],
      activeCount: 2850,
    },
    {
      code: TV_PLAN_CODES.FULL,
      catalogId: "c3",
      name: "TV Full",
      monthlyPrice: TV_PLAN_PRICES[TV_PLAN_CODES.FULL],
      activeCount: 400,
    },
  ])
  assert.equal(summary.plans[0].monthlyRevenue, 12_825_000)
  assert.equal(summary.plans[1].monthlyRevenue, 3_960_000)
  assert.equal(summary.totalActiveCustomers, 3250)
  assert.equal(summary.totalMonthlyRevenue, 16_785_000)
  assert.equal(tvPlanRevenue(0, 12500), 0)
  assert.notEqual(summary.totalMonthlyRevenue, 3250 * 35000)
})

test("el conteo usa el componente TV del servicio comercial, no el nombre", () => {
  assert.match(queries, /tv_plan_catalog_id/)
  assert.match(tvComponent, /tv_plan_catalog_id/)
  assert.doesNotMatch(queries, /name\.includes\(["'`]TV/)
  assert.doesNotMatch(ui, /name\.includes\(["'`]TV/)
  assert.equal(
    isCountableTvService({
      companyId: "co-1",
      actorCompanyId: "co-1",
      tvPlanCatalogId: "tv-full",
      commercialStatus: "active",
    }),
    true
  )
  assert.equal(
    isCountableTvService({
      companyId: "co-1",
      actorCompanyId: "co-1",
      tvPlanCatalogId: null,
      commercialStatus: "active",
    }),
    false
  )
  assert.equal(
    isCountableTvService({
      companyId: "co-1",
      actorCompanyId: "co-1",
      tvPlanCatalogId: "tv-full",
      commercialStatus: "cancelled",
    }),
    false
  )
})

test("el click del KPI permanece en /subscriptions y filtra el plan", () => {
  const overview = read(
    "components/subscriptions/subscriptions-tv-overview.tsx"
  )
  assert.doesNotMatch(cards, /href=.*clientes-360/)
  assert.doesNotMatch(overview, /href=.*clientes-360/)
  assert.match(overview, /onClick=\{\(\) => setSelectedPlan\("all"\)\}/)
  assert.match(cards, /setSelectedPlan\(plan\.catalogId\)/)
  assert.equal(
    serviceMatchesSelectedPlan({
      tvPlanCatalogId: "tv-full",
      selected: "tv-full",
    }),
    true
  )
  assert.equal(
    serviceMatchesSelectedPlan({
      tvPlanCatalogId: "tv-basico",
      selected: "tv-full",
    }),
    false
  )
  assert.match(ui, /Ver Cliente 360/)
  assert.match(ui, /commercialPlanName/)
  assert.match(queries, /count: "exact"/)
  assert.match(queries, /\.range\(/)
})

test("Clientes 360, facturación, SIRO, Excel y subscription_* no cambian", () => {
  assert.match(serviceCard, /service\.planName/)
  assert.doesNotMatch(customer360, /tvPlanCatalogId/)
  assert.doesNotMatch(read("lib/isp/billing-run-engine.ts"), /tv_plan_catalog_id/)
  assert.doesNotMatch(read("lib/isp/billing-integrity.ts"), /tv_plan_catalog_id/)
  assert.doesNotMatch(read("lib/isp/migration/constants.ts"), /plan_tv/)
  assert.doesNotMatch(queries, /subscription_customers/)
  assert.doesNotMatch(queries, /subscription_sales/)
  assert.doesNotMatch(rls, /DROP TABLE/)
})

test("el formulario de plan TV fuerza categoría TV y precio >= 0", () => {
  const valid = validateTvPlanWriteDraft({
    name: "TV Premium",
    code: "TV-PREMIUM",
    monthlyPrice: "12500",
    isActive: true,
  })
  assert.equal(valid.valid, true)
  const invalidPrice = validateTvPlanWriteDraft({
    name: "TV Premium",
    code: "TV-PREMIUM",
    monthlyPrice: "-1",
    isActive: true,
  })
  assert.equal(invalidPrice.valid, false)
  assert.equal(invalidPrice.message, TV_PLAN_PRICE_INVALID_MESSAGE)
  const mapped = tvPlanWriteDraftToCatalogDraft({
    name: "TV Premium",
    code: "TV-PREMIUM",
    monthlyPrice: "12500",
    isActive: true,
  })
  assert.equal(mapped.category, "tv")
  assert.equal(mapped.requiresConnection, false)
  assert.equal(mapped.billingMethod, "siro")
  assert.equal(mapped.includesTv, false)
  assert.match(catalogUi, /Planes de TV/)
  assert.match(catalogUi, /Nuevo plan TV/)
  assert.equal(isTvCatalogCategory("tv"), true)
})
