/**
 * TV & Suscripciones 1.2 — administrative desk: filters, search, clients.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { isSelectableTvCatalogPlan } from "../lib/isp/catalog-integrity.ts"
import { ISP_COMMERCIAL_STATUSES } from "../lib/isp/constants.ts"
import { ISP_COMMERCIAL_STATUS_LABELS } from "../lib/isp/labels.ts"
import {
  commercialOptionsForPlan,
  DEFAULT_TV_LIST_PAGE_SIZE,
  EMPTY_TV_DESK_FILTERS,
  formatTvListCount,
  hasTvDeskListFilters,
  isCountableTvService,
  matchesTvListSearch,
  resolveTvListCommercialIds,
  serviceMatchesSelectedPlan,
  summarizeTvPlans,
  TV_PLAN_CODES,
  TV_PLAN_PRICES,
  tvDeskEmptyListMessage,
  tvPlanRevenue,
} from "../lib/subscriptions/tv-plans.ts"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

const queries = read("lib/supabase/subscriptions.queries.ts")
const ui = read("components/subscriptions/subscriptions-module.tsx")
const cards = read("components/subscriptions/subscriptions-summary-cards.tsx")
const overview = read(
  "components/subscriptions/subscriptions-tv-overview.tsx"
)
const filters = read("components/subscriptions/tv-subscribers-filters.tsx")
const catalogUi = read("components/subscriptions/tv-plans-catalog-section.tsx")
const provider = read("components/subscriptions/subscriptions-provider.tsx")
const form = read("components/isp/isp-catalog-form-screen.tsx")

test("1-3. KPIs dinámicos, plan nuevo y plan con 0 clientes", () => {
  const premium = summarizeTvPlans([
    {
      code: "TV-PREMIUM",
      catalogId: "tv-premium",
      name: "TV Premium",
      monthlyPrice: 12500,
      activeCount: 0,
    },
    {
      code: TV_PLAN_CODES.FULL,
      catalogId: "tv-full",
      name: "TV Full",
      monthlyPrice: TV_PLAN_PRICES[TV_PLAN_CODES.FULL],
      activeCount: 400,
    },
  ])
  assert.equal(premium.plans.length, 2)
  assert.equal(premium.plans[0].activeCount, 0)
  assert.equal(premium.plans[0].monthlyRevenue, 0)
  assert.equal(premium.plans[1].activeCount, 400)
  assert.match(cards, /plans\.map/)
  assert.doesNotMatch(cards, /TV_PLAN_NAMES/)
  assert.match(catalogUi, /0 clientes|clientes/)
})

test("4-7. cantidad, ingreso TV, total solo TV, Internet no se incluye", () => {
  const summary = summarizeTvPlans([
    {
      code: TV_PLAN_CODES.BASICO,
      catalogId: "c1",
      name: "TV Básico",
      monthlyPrice: 4500,
      activeCount: 2850,
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
  assert.equal(summary.plans[1].monthlyRevenue, tvPlanRevenue(400, 9900))
  assert.equal(summary.totalActiveCustomers, 3250)
  assert.equal(summary.totalMonthlyRevenue, 16_785_000)
  assert.notEqual(summary.totalMonthlyRevenue, 3250 * 35000)
  assert.match(overview, /Ingreso mensual TV/)
  assert.match(overview, /No incluye Internet/)
})

test("8-10. click KPI filtra en /subscriptions; Ver Cliente 360 navega por fila", () => {
  assert.doesNotMatch(cards, /href=.*clientes-360/)
  assert.doesNotMatch(overview, /href=.*clientes-360/)
  assert.match(cards, /setSelectedPlan\(plan\.catalogId\)/)
  assert.match(overview, /setSelectedPlan\("all"\)/)
  assert.match(ui, /Ver Cliente 360/)
  assert.match(ui, /\/clientes-360\/\$\{row\.customerId\}/)
  assert.doesNotMatch(ui, /Upgrade/)
  assert.doesNotMatch(ui, /Downgrade/)
  assert.doesNotMatch(ui, /Cambiar plan/)
  assert.equal(
    serviceMatchesSelectedPlan({
      tvPlanCatalogId: "tv-full",
      selected: "tv-full",
    }),
    true
  )
})

test("11-16. búsqueda, filtros combinables, limpiar y paginación", () => {
  assert.match(queries, /escapeCustomerSearchPattern/)
  assert.match(queries, /name\.ilike/)
  assert.match(queries, /dni\.ilike/)
  assert.match(queries, /customer_number\.ilike/)
  assert.match(queries, /whatsapp\.ilike/)
  assert.match(queries, /\.eq\("company_id", input\.companyId\)/)
  assert.match(queries, /resolveTvListCommercialIds/)
  assert.match(queries, /selectedCommercialId/)
  assert.match(queries, /commercial_status/)
  assert.match(filters, /Plan TV/)
  assert.match(filters, /Abono \/ Servicio/)
  assert.match(filters, /Limpiar filtros/)
  assert.match(filters, /Filtro activo/)
  assert.match(provider, /clearFilters/)
  assert.match(queries, /count: "exact"/)
  assert.match(queries, /\.range\(/)
  assert.equal(DEFAULT_TV_LIST_PAGE_SIZE, 50)
  assert.match(ui, /Página \{currentPage\} de \{totalPages\}/)

  const grouped = new Map([
    ["tv-full", ["cat-300-full", "cat-500-full"]],
    ["tv-basico", ["cat-300-basico"]],
  ])
  assert.deepEqual(
    resolveTvListCommercialIds({
      commercialIdsByTvPlan: grouped,
      selectedPlan: "tv-full",
      selectedCommercialId: "cat-300-full",
    }),
    ["cat-300-full"]
  )
  assert.deepEqual(
    resolveTvListCommercialIds({
      commercialIdsByTvPlan: grouped,
      selectedPlan: "all",
      selectedCommercialId: "all",
    }).sort(),
    ["cat-300-basico", "cat-300-full", "cat-500-full"]
  )
  assert.equal(
    hasTvDeskListFilters({
      selectedPlan: "all",
      selectedCommercialId: "all",
      status: "all",
      search: "",
    }),
    false
  )
  assert.equal(
    hasTvDeskListFilters({
      selectedPlan: "tv-full",
      selectedCommercialId: "all",
      status: "active",
      search: "",
    }),
    true
  )
  assert.equal(EMPTY_TV_DESK_FILTERS.selectedPlan, "all")
  assert.equal(EMPTY_TV_DESK_FILTERS.status, "all")
  assert.equal(
    matchesTvListSearch(
      {
        customerName: "Juan Pérez",
        phone: "351555",
        locality: "Córdoba",
        dni: "20123456",
        customerNumber: "A-100",
      },
      "20123456"
    ),
    true
  )
  assert.equal(
    matchesTvListSearch(
      {
        customerName: "María López",
        phone: "",
        locality: "",
        dni: "",
        customerNumber: "",
      },
      "Juan"
    ),
    false
  )
})

test("17. paginación server-side de 50", () => {
  assert.equal(DEFAULT_TV_LIST_PAGE_SIZE, 50)
  assert.match(provider, /DEFAULT_TV_LIST_PAGE_SIZE/)
  assert.match(queries, /pageSize/)
})

test("18-21. sin TV no aparece; nombre comercial; importe TV del catálogo", () => {
  assert.equal(
    isCountableTvService({
      companyId: "co-1",
      actorCompanyId: "co-1",
      tvPlanCatalogId: null,
      commercialStatus: "active",
    }),
    false
  )
  assert.match(ui, /commercialPlanName/)
  assert.match(ui, /Servicio \/ Abono/)
  assert.match(ui, /Importe TV/)
  assert.match(queries, /tvPlan\.monthlyPrice/)
  assert.doesNotMatch(queries, /row\.monthly_fee/)
  assert.match(catalogUi, /Ingreso mensual TV/)
})

test("22-23. planes inactivos no se ofrecen a nuevos servicios y no rompen existentes", () => {
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
})

test("24. multi-tenant en queries y filtros", () => {
  assert.match(queries, /\.eq\("company_id", companyId\)/)
  assert.match(queries, /\.eq\("company_id", input\.companyId\)/)
  assert.equal(
    isCountableTvService({
      companyId: "co-b",
      actorCompanyId: "co-a",
      tvPlanCatalogId: "tv-full",
      commercialStatus: "active",
    }),
    false
  )
})

test("25-27. no usa subscription_*; facturación y SIRO no cambian", () => {
  assert.doesNotMatch(queries, /subscription_customers/)
  assert.doesNotMatch(queries, /subscription_services/)
  assert.doesNotMatch(queries, /subscription_sales/)
  assert.doesNotMatch(ui, /siro_/)
  assert.doesNotMatch(read("lib/isp/billing-run-engine.ts"), /tv_plan_catalog_id/)
  assert.doesNotMatch(read("lib/isp/migration/constants.ts"), /"plan_tv"/)
  assert.doesNotMatch(filters, /includes\(["']TV["']\)/)
  assert.doesNotMatch(queries, /name\.includes\(["'`]TV/)
})

test("filtro de abono solo muestra servicios con componente TV", () => {
  const options = commercialOptionsForPlan(
    [
      {
        id: "cat-full",
        name: "Plan 300 Megas + TV Full",
        tvPlanCatalogId: "tv-full",
      },
      {
        id: "cat-basico",
        name: "Plan 300 Megas + TV Básico",
        tvPlanCatalogId: "tv-basico",
      },
    ],
    "tv-full"
  )
  assert.deepEqual(
    options.map((item) => item.name),
    ["Plan 300 Megas + TV Full"]
  )
  assert.match(queries, /not\("tv_plan_catalog_id", "is", null\)/)
})

test("estados del filtro son los de isp_services", () => {
  for (const status of ISP_COMMERCIAL_STATUSES) {
    assert.ok(ISP_COMMERCIAL_STATUS_LABELS[status])
  }
  assert.match(filters, /ISP_COMMERCIAL_STATUSES/)
  assert.match(filters, /Pendiente de alta|ISP_COMMERCIAL_STATUS_LABELS/)
})

test("empty state y contador del listado", () => {
  assert.equal(
    tvDeskEmptyListMessage({
      selectedPlanName: "TV Full",
      hasFilters: true,
    }),
    "No hay clientes con TV Full que coincidan con los filtros seleccionados."
  )
  assert.equal(formatTvListCount(400), "Mostrando 400 clientes")
  assert.equal(formatTvListCount(1), "Mostrando 1 cliente")
  assert.match(ui, /tvDeskEmptyListMessage/)
  assert.match(ui, /formatTvListCount/)
})

test("jerarquía: catálogo, resumen y clientes separados", () => {
  assert.match(ui, /TvPlansCatalogSection/)
  assert.match(ui, /SubscriptionsTvOverview/)
  assert.match(ui, /SubscriptionsSummaryCards/)
  assert.match(ui, /TvSubscribersFilters/)
  assert.match(ui, /Administración y seguimiento de los servicios de TV/)
  assert.match(catalogUi, /Planes de TV/)
  assert.match(overview, /Resumen TV/)
  assert.match(ui, /Clientes con TV/)
})
