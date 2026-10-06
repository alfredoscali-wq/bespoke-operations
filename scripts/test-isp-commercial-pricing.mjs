import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  ISP_COMMERCIAL_COMPONENT_INCOMPATIBLE,
  ISP_COMMERCIAL_COMPONENT_INACTIVE,
  ISP_COMMERCIAL_COMPONENT_PRICE_MISSING,
  calculateCommercialPrice,
  commercialComponentAssignmentError,
  componentMatchesCatalog,
} from "../lib/isp/commercial-pricing.ts"

const root = resolve(import.meta.dirname, "..")
const migration = readFileSync(
  resolve(
    root,
    "supabase/migrations/20261231130000_isp_commercial_components_and_conditions.sql"
  ),
  "utf8"
)

const packFutbol = {
  category: "internet",
  requiresIncludedTv: true,
}
const publicIp = { category: "internet" }
const tvFullUpgrade = {
  category: "internet",
  requiresIncludedTv: true,
  includedTvCode: "TV-BASICO",
}

const baseWithTv = { category: "internet", includedTvCode: "TV-BASICO" }
const baseWithoutTv = { category: "internet", includedTvCode: null }
const baseWithFull = { category: "internet", includedTvCode: "TV-FULL" }

function priceBody() {
  const start = migration.indexOf(
    "CREATE OR REPLACE FUNCTION public.apply_isp_service_commercial_price"
  )
  const end = migration.indexOf(
    "COMMENT ON FUNCTION public.apply_isp_service_commercial_price"
  )
  return migration.slice(start, end)
}

test("el abono base más componentes y condición producen el precio final", () => {
  const plain = calculateCommercialPrice({
    listPrice: 39300,
    components: [],
    discountPercent: null,
  })
  assert.deepEqual(plain, {
    priceSubtotal: 39300,
    discountAmount: 0,
    monthlyFee: 39300,
  })

  const withFootball = calculateCommercialPrice({
    listPrice: 39300,
    components: [
      { unitPrice: 3000, isRecurring: true, status: "active" },
      { unitPrice: 999, isRecurring: true, status: "cancelled" },
    ],
    discountPercent: 0,
  })
  assert.equal(withFootball.priceSubtotal, 42300)
  assert.equal(withFootball.monthlyFee, 42300)

  const withUpgrade = calculateCommercialPrice({
    listPrice: 39300,
    components: [
      { unitPrice: 3000, isRecurring: true, status: "active" },
      { unitPrice: 5400, isRecurring: true, status: "active" },
    ],
    discountPercent: 50,
  })
  assert.equal(withUpgrade.priceSubtotal, 47700)
  assert.equal(withUpgrade.discountAmount, 23850)
  assert.equal(withUpgrade.monthlyFee, 23850)

  const waived = calculateCommercialPrice({
    listPrice: 39300,
    components: [],
    discountPercent: 100,
  })
  assert.equal(waived.priceSubtotal, 39300)
  assert.equal(waived.discountAmount, 39300)
  assert.equal(waived.monthlyFee, 0)
})

test("un componente nuevo entra por precio e is_recurring, no por código", () => {
  const priced = calculateCommercialPrice({
    listPrice: 32800,
    components: [{ unitPrice: 1000, isRecurring: true, status: "active" }],
    discountPercent: null,
  })
  assert.equal(priced.monthlyFee, 33800)

  const skipped = calculateCommercialPrice({
    listPrice: 32800,
    components: [{ unitPrice: 1000, isRecurring: false, status: "active" }],
    discountPercent: null,
  })
  assert.equal(skipped.monthlyFee, 32800)
})

test("la compatibilidad mira el abono y la TV incluida, no el código del componente", () => {
  assert.equal(componentMatchesCatalog(packFutbol, baseWithTv), true)
  assert.equal(componentMatchesCatalog(packFutbol, baseWithoutTv), false)
  assert.equal(componentMatchesCatalog(packFutbol, baseWithFull), true)
  assert.equal(componentMatchesCatalog(publicIp, baseWithoutTv), true)
  assert.equal(componentMatchesCatalog(tvFullUpgrade, baseWithTv), true)
  assert.equal(componentMatchesCatalog(tvFullUpgrade, baseWithFull), false)
  assert.equal(componentMatchesCatalog(tvFullUpgrade, baseWithoutTv), false)

  assert.equal(
    commercialComponentAssignmentError({
      isActive: false,
      monthlyPrice: null,
      compatibility: publicIp,
      catalog: baseWithoutTv,
    }),
    ISP_COMMERCIAL_COMPONENT_INACTIVE
  )
  assert.equal(
    commercialComponentAssignmentError({
      isActive: true,
      monthlyPrice: null,
      compatibility: publicIp,
      catalog: baseWithoutTv,
    }),
    ISP_COMMERCIAL_COMPONENT_PRICE_MISSING
  )
  assert.equal(
    commercialComponentAssignmentError({
      isActive: true,
      monthlyPrice: 3000,
      compatibility: packFutbol,
      catalog: baseWithoutTv,
    }),
    ISP_COMMERCIAL_COMPONENT_INCOMPATIBLE
  )
  assert.equal(
    commercialComponentAssignmentError({
      isActive: true,
      monthlyPrice: 5400,
      compatibility: tvFullUpgrade,
      catalog: baseWithTv,
    }),
    null
  )
})

test("la migración no crea planes combinados ni reescribe abonos existentes", () => {
  assert.match(migration, /isp_commercial_components/)
  assert.match(migration, /isp_service_components/)
  assert.match(migration, /isp_commercial_conditions/)
  assert.match(migration, /isp_service_conditions/)
  assert.match(migration, /price_subtotal/)
  assert.match(migration, /discount_amount/)
  assert.match(migration, /00000000-0000-4000-8000-000000000002/)
  assert.match(migration, /PACK-FUTBOL/)
  assert.match(migration, /IP-PUBLICA/)
  assert.match(migration, /TV-FULL-UPGRADE/)
  assert.match(migration, /3000\.00/)
  assert.match(migration, /5400\.00/)
  assert.match(migration, /NULL::numeric/)
  assert.match(migration, /JUBILADO/)
  assert.match(migration, /CONVENIO-NODO/)
  assert.match(migration, /50\.00/)
  assert.match(migration, /100\.00/)
  assert.match(migration, /includedTvCode/)
  assert.match(migration, /requiresIncludedTv/)
  assert.doesNotMatch(migration, /INSERT INTO public\.isp_service_catalog/)
  assert.doesNotMatch(migration, /UPDATE public\.isp_service_catalog/)
  assert.doesNotMatch(migration, /UPDATE public\.tasks/)
  assert.doesNotMatch(migration, /UPDATE public\.customers/)

  const body = priceBody()
  assert.match(body, /monthly_fee/)
  assert.match(body, /price_subtotal/)
  assert.match(body, /discount_amount/)
  assert.doesNotMatch(body, /PACK-FUTBOL/)
  assert.doesNotMatch(body, /JUBILADO/)
  assert.doesNotMatch(body, /TV-FULL/)
  assert.doesNotMatch(body, /compatibility/)
})
