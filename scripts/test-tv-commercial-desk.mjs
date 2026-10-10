import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { calculateCommercialPrice } from "../lib/isp/commercial-pricing.ts"
import {
  classifyCommercialTvSubscription,
  commercialDeskMonthlyFee,
  matchesTvCommercialDeskFilters,
  summarizeTvCommercialDesk,
} from "../lib/subscriptions/tv-commercial-desk.ts"

const root = resolve(import.meta.dirname, "..")

function fact(overrides) {
  return {
    serviceId: overrides.serviceId,
    customerId: overrides.customerId,
    tvTier: overrides.tvTier,
    packFutbolActive: overrides.packFutbolActive ?? false,
    jubilado: overrides.jubilado ?? false,
    commercialStatus: overrides.commercialStatus ?? "active",
    commercialMonthlyFee: overrides.commercialMonthlyFee ?? null,
    commercialCatalogId: overrides.commercialCatalogId ?? "plan",
    customerName: overrides.customerName ?? "Cliente",
    customerNumber: overrides.customerNumber ?? "",
    externalCustomerNumber: overrides.externalCustomerNumber ?? null,
  }
}

test("TV-BASICO es Básica y el upgrade es Full, sin el plan histórico", () => {
  assert.deepEqual(
    classifyCommercialTvSubscription({
      includedTvCode: "TV-BASICO",
      activeComponentCodes: [],
    }),
    { tier: "basica", packFutbol: false, jubilado: false, represented: true }
  )
  assert.equal(
    classifyCommercialTvSubscription({
      includedTvCode: "TV-BASICO",
      activeComponentCodes: ["TV-FULL-UPGRADE"],
    }).tier,
    "full"
  )
  assert.equal(
    classifyCommercialTvSubscription({
      includedTvCode: "TV-BASICO",
      activeComponentCodes: ["PACK-FUTBOL"],
    }).packFutbol,
    true
  )
  assert.equal(
    classifyCommercialTvSubscription({
      includedTvCode: "TV-BASICO",
      activeComponentCodes: ["TV-FULL-UPGRADE", "PACK-FUTBOL"],
    }).tier,
    "full"
  )
  assert.equal(
    classifyCommercialTvSubscription({
      includedTvCode: "TV-FULL",
      activeComponentCodes: [],
    }).represented,
    false
  )
  assert.equal(
    classifyCommercialTvSubscription({
      includedTvCode: "TV-BASICO-FUTBOL",
      activeComponentCodes: [],
    }).packFutbol,
    false
  )
})

test("un cliente con varios componentes cuenta una vez y Full no es Básica", () => {
  const summary = summarizeTvCommercialDesk([
    fact({
      serviceId: "s-basica",
      customerId: "c1",
      tvTier: "basica",
      commercialMonthlyFee: 39300,
    }),
    fact({
      serviceId: "s-full",
      customerId: "c2",
      tvTier: "full",
      packFutbolActive: true,
      commercialMonthlyFee: 47700,
    }),
    fact({
      serviceId: "s-full-2",
      customerId: "c2",
      tvTier: "full",
      commercialMonthlyFee: 44700,
    }),
    fact({
      serviceId: "s-historico",
      customerId: "c3",
      tvTier: "none",
      commercialMonthlyFee: 9900,
    }),
    fact({
      serviceId: "s-cancel",
      customerId: "c4",
      tvTier: "basica",
      commercialStatus: "cancelled",
      commercialMonthlyFee: 1000,
    }),
  ])
  assert.equal(summary.basicaCustomers, 1)
  assert.equal(summary.fullCustomers, 1)
  assert.equal(summary.packFutbolCustomers, 1)
  assert.equal(summary.totalCustomers, 2)
  assert.equal(summary.monthlyRevenue, 39300 + 47700 + 44700)
})

test("el precio usa el cálculo comercial y Jubilado sigue al 50%", () => {
  const jubilado = commercialDeskMonthlyFee({
    listPrice: 39300,
    catalogMonthlyPrice: null,
    components: [
      { unitPrice: 5400, isRecurring: true },
      { unitPrice: 3000, isRecurring: true },
    ],
    discountPercent: 50,
  })
  const expected = calculateCommercialPrice({
    listPrice: 39300,
    components: [
      { unitPrice: 5400, isRecurring: true, status: "active" },
      { unitPrice: 3000, isRecurring: true, status: "active" },
    ],
    discountPercent: 50,
  }).monthlyFee
  assert.equal(jubilado, expected)
  assert.equal(jubilado, 23850)
  assert.notEqual(jubilado, 39300 + 3000)
  assert.notEqual(jubilado, 4500 + 9900)

  const classified = classifyCommercialTvSubscription({
    includedTvCode: "TV-BASICO",
    activeComponentCodes: ["TV-FULL-UPGRADE", "PACK-FUTBOL"],
    conditionCode: "JUBILADO",
  })
  assert.equal(classified.jubilado, true)
  assert.equal(classified.tier, "full")
})

test("los filtros usan la representación comercial", () => {
  const full = fact({
    serviceId: "s1",
    customerId: "c1",
    tvTier: "full",
    packFutbolActive: true,
    jubilado: true,
    customerNumber: "CLI-000001",
    externalCustomerNumber: "5032",
  })
  const filters = {
    tvTier: "all",
    pack: "all",
    condition: "all",
    selectedCommercialId: "all",
    status: "active",
    search: "",
  }
  assert.equal(
    matchesTvCommercialDeskFilters(full, { ...filters, tvTier: "basica" }),
    false
  )
  assert.equal(
    matchesTvCommercialDeskFilters(full, { ...filters, tvTier: "full" }),
    true
  )
  assert.equal(
    matchesTvCommercialDeskFilters(full, { ...filters, pack: "without_pack" }),
    false
  )
  assert.equal(
    matchesTvCommercialDeskFilters(full, { ...filters, pack: "with_pack" }),
    true
  )
  assert.equal(
    matchesTvCommercialDeskFilters(full, { ...filters, condition: "jubilado" }),
    true
  )
  assert.equal(
    matchesTvCommercialDeskFilters(
      { ...full, jubilado: false },
      { ...filters, condition: "jubilado" }
    ),
    false
  )
  assert.equal(
    matchesTvCommercialDeskFilters(full, { ...filters, search: "5032" }),
    true
  )

  const queries = readFileSync(
    resolve(root, "lib/supabase/subscriptions.queries.ts"),
    "utf8"
  )
  assert.match(queries, /TV_BASICO_INCLUDED_CODE|TV-BASICO/)
  assert.match(queries, /TV_FULL_UPGRADE_CODE|TV-FULL-UPGRADE/)
  assert.match(queries, /PACK_FUTBOL_CODE|PACK-FUTBOL/)
  assert.match(queries, /commercialDeskMonthlyFee/)
  assert.doesNotMatch(queries, /isp_connections/)
  assert.doesNotMatch(queries, /\.insert\(/)
  assert.doesNotMatch(queries, /\.update\(/)
  assert.doesNotMatch(queries, /\.delete\(/)
  assert.doesNotMatch(queries, /\.upsert\(/)

  const provider = readFileSync(
    resolve(root, "components/subscriptions/subscriptions-provider.tsx"),
    "utf8"
  )
  const desk = readFileSync(
    resolve(root, "components/subscriptions/tv-commercial-desk-section.tsx"),
    "utf8"
  )
  const moduleUi = readFileSync(
    resolve(root, "components/subscriptions/subscriptions-module.tsx"),
    "utf8"
  )
  assert.match(provider, /listTvCommercialDesk/)
  assert.match(provider, /matchesTvCommercialDeskFilters/)
  assert.match(moduleUi, /TvCommercialDeskSection/)
  assert.match(desk, /commercialMonthlyFee/)
  assert.match(desk, /basica/)
  assert.match(desk, /full/)
  assert.match(desk, /with_pack/)
  assert.match(desk, /without_pack/)
  assert.match(desk, /jubilado/)
  assert.doesNotMatch(desk, /calculateCommercialPrice/)
  assert.doesNotMatch(desk, /list_price/)
  assert.match(desk, /PackFutbolAction/)
  assert.doesNotMatch(moduleUi, /PackFutbolAction/)
})
