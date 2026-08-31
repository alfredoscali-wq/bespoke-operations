/**
 * TV & Suscripciones 1.0 — desk over Clientes 360 / isp_services.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { APP_MODULE_KEYS } from "../lib/roles/app-modules.ts"
import { DEFAULT_COMPANY_AREA_MODULE_VISIBILITY } from "../lib/roles/company-areas.ts"
import {
  DEFAULT_TV_LIST_PAGE_SIZE,
  isCountableTvService,
  isTvCatalogCategory,
  matchesTvListSearch,
  serviceMatchesSelectedPlan,
  summarizeTvPlans,
  TV_CATALOG_CATEGORY,
  TV_PLAN_CODES,
  TV_PLAN_DEFINITIONS,
  TV_PLAN_NAMES,
  TV_PLAN_PRICES,
  tvPlanRevenue,
  tvServiceBelongsToCompany,
} from "../lib/subscriptions/tv-plans.ts"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

const migration = read(
  "supabase/migrations/20261203000100_tv_subscriptions_1_0.sql"
)

test("los tres planes TV existen con precios, categoría TV y sin conexión", () => {
  assert.equal(TV_PLAN_DEFINITIONS.length, 3)
  assert.equal(TV_PLAN_PRICES[TV_PLAN_CODES.BASICO], 4500)
  assert.equal(TV_PLAN_PRICES[TV_PLAN_CODES.BASICO_FUTBOL], 7500)
  assert.equal(TV_PLAN_PRICES[TV_PLAN_CODES.FULL], 9900)
  assert.equal(TV_PLAN_NAMES[TV_PLAN_CODES.BASICO], "TV Básico")
  assert.equal(
    TV_PLAN_NAMES[TV_PLAN_CODES.BASICO_FUTBOL],
    "TV Básico + Pack Fútbol"
  )
  assert.equal(TV_PLAN_NAMES[TV_PLAN_CODES.FULL], "TV Full")
  assert.equal(TV_CATALOG_CATEGORY, "tv")

  assert.match(migration, /'TV Básico'/)
  assert.match(migration, /'TV Básico \+ Pack Fútbol'/)
  assert.match(migration, /'TV Full'/)
  assert.match(migration, /4500\.00/)
  assert.match(migration, /7500\.00/)
  assert.match(migration, /9900\.00/)
  assert.match(migration, /'tv'/)
  assert.match(migration, /requires_connection = false/)
  assert.match(migration, /'siro'/)
  assert.match(migration, /FROM public\.companies/)
})

test("TV se asigna al customer_id de Clientes 360, no al padrón prototype", () => {
  const queries = read("lib/supabase/subscriptions.queries.ts")
  assert.match(queries, /from\("isp_services"\)/)
  assert.match(queries, /from\("isp_service_catalog"\)/)
  assert.match(queries, /isp_services_customer_id_fkey/)
  assert.doesNotMatch(queries, /subscription_customers/)
  assert.doesNotMatch(queries, /subscription_sales/)
  assert.match(migration, /customer_id/)
  assert.match(migration, /enforce_one_active_tv_service/)
  assert.match(
    read("supabase/migrations/20261128000100_isp_1_0_clientes_360_conexiones.sql"),
    /customer_id uuid NOT NULL REFERENCES public\.customers/
  )
})

test("KPIs cuentan por plan, calculan ingreso y el total suma los tres", () => {
  const summary = summarizeTvPlans([
    {
      code: TV_PLAN_CODES.BASICO,
      catalogId: "c1",
      name: "TV Básico",
      monthlyPrice: 4500,
      activeCount: 2850,
    },
    {
      code: TV_PLAN_CODES.BASICO_FUTBOL,
      catalogId: "c2",
      name: "TV Básico + Pack Fútbol",
      monthlyPrice: 7500,
      activeCount: 750,
    },
    {
      code: TV_PLAN_CODES.FULL,
      catalogId: "c3",
      name: "TV Full",
      monthlyPrice: 9900,
      activeCount: 400,
    },
  ])

  assert.equal(summary.plans[0].monthlyRevenue, 12_825_000)
  assert.equal(summary.plans[1].monthlyRevenue, 5_625_000)
  assert.equal(summary.plans[2].monthlyRevenue, 3_960_000)
  assert.equal(summary.totalActiveCustomers, 4000)
  assert.equal(summary.totalMonthlyRevenue, 22_410_000)
  assert.equal(tvPlanRevenue(2, 4500), 9000)
  assert.equal(tvPlanRevenue(0, 9900), 0)
})

test("el drill-down de cada KPI solo incluye el plan seleccionado", () => {
  const rows = [
    { tvPlanCatalogId: "tv-basico", customerName: "Ana" },
    { tvPlanCatalogId: "tv-full", customerName: "Bruno" },
    { tvPlanCatalogId: "tv-basico", customerName: "Carla" },
  ]
  const basico = rows.filter((row) =>
    serviceMatchesSelectedPlan({
      tvPlanCatalogId: row.tvPlanCatalogId,
      selected: "tv-basico",
    })
  )
  assert.deepEqual(
    basico.map((row) => row.customerName),
    ["Ana", "Carla"]
  )
  assert.equal(
    rows.filter((row) =>
      serviceMatchesSelectedPlan({
        tvPlanCatalogId: row.tvPlanCatalogId,
        selected: "all",
      })
    ).length,
    3
  )
})

test("búsqueda y paginación no requieren cargar el universo en memoria", () => {
  const queries = read("lib/supabase/subscriptions.queries.ts")
  assert.match(queries, /count: "exact"/)
  assert.match(queries, /\.range\(/)
  assert.match(queries, /head: true/)
  assert.doesNotMatch(queries, /select\("\*"\)/)
  assert.equal(DEFAULT_TV_LIST_PAGE_SIZE, 50)

  const page = ["a", "b", "c", "d", "e"].slice(50, 100)
  assert.deepEqual(page, [])
  assert.equal(
    matchesTvListSearch(
      {
        customerName: "Pérez Juan",
        phone: "2914123456",
        locality: "Bahía Blanca",
        dni: "30111222",
        customerNumber: "C-20",
      },
      "bahía"
    ),
    true
  )
  assert.equal(
    matchesTvListSearch(
      {
        customerName: "Pérez Juan",
        phone: "2914123456",
        locality: "Bahía Blanca",
        dni: "30111222",
        customerNumber: "C-20",
      },
      "internet"
    ),
    false
  )
})

test("no mezcla tenants ni servicios de Internet en el ingreso TV", () => {
  const actor = "company-a"
  assert.equal(tvServiceBelongsToCompany("company-a", actor), true)
  assert.equal(tvServiceBelongsToCompany("company-b", actor), false)

  assert.equal(
    isCountableTvService({
      companyId: "company-a",
      actorCompanyId: actor,
      tvPlanCatalogId: "tv-basico",
      commercialStatus: "active",
    }),
    true
  )
  assert.equal(
    isCountableTvService({
      companyId: "company-b",
      actorCompanyId: actor,
      tvPlanCatalogId: "tv-basico",
      commercialStatus: "active",
    }),
    false
  )
  assert.equal(
    isCountableTvService({
      companyId: "company-a",
      actorCompanyId: actor,
      tvPlanCatalogId: null,
      commercialStatus: "active",
    }),
    false
  )
  assert.equal(
    isCountableTvService({
      companyId: "company-a",
      actorCompanyId: actor,
      tvPlanCatalogId: "tv-basico",
      commercialStatus: "cancelled",
    }),
    false
  )
  assert.equal(isTvCatalogCategory("internet"), false)
  assert.equal(isTvCatalogCategory("tv"), true)

  const internetFee = 25000
  const tvOnly = summarizeTvPlans([
    {
      code: TV_PLAN_CODES.BASICO,
      catalogId: "tv1",
      name: "TV Básico",
      monthlyPrice: 4500,
      activeCount: 1,
    },
  ])
  assert.equal(tvOnly.totalMonthlyRevenue, 4500)
  assert.notEqual(tvOnly.totalMonthlyRevenue, internetFee + 4500)
})

test("la ruta /subscriptions y el módulo subscriptions se mantienen", () => {
  assert.ok(APP_MODULE_KEYS.includes("subscriptions"))
  assert.equal(
    DEFAULT_COMPANY_AREA_MODULE_VISIBILITY.administracion.subscriptions,
    true
  )
  assert.equal(DEFAULT_COMPANY_AREA_MODULE_VISIBILITY.ventas.subscriptions, true)

  const nav = read("lib/navigation/nav-items.ts")
  assert.match(nav, /TV & Suscripciones/)
  assert.match(nav, /href: "\/subscriptions"/)

  const modules = read("lib/roles/app-modules.ts")
  assert.match(modules, /key: "subscriptions"/)
  assert.match(modules, /pathPrefixes: \["\/subscriptions"\]/)

  const page = read("app/(dashboard)/subscriptions/page.tsx")
  assert.match(page, /SubscriptionsModule/)

  const ui = read("components/subscriptions/subscriptions-module.tsx")
  assert.match(ui, /\/clientes-360\//)
  assert.doesNotMatch(ui, /Pre-Alta/)
  assert.doesNotMatch(ui, /Comisiones/)
  assert.doesNotMatch(ui, /prorrate/)
  assert.match(migration, /auth_user_has_allowed_module\('subscriptions'\)/)
  assert.match(migration, /DEPRECATED prototype/)
})
