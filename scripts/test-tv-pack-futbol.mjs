import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  canConfirmPackFutbol,
  canOfferPackFutbol,
  commercialTvTier,
  commercialTvTierLabel,
  interpretPackFutbolResponse,
  PACK_FUTBOL_CODE,
  packFutbolQuotedFees,
} from "../lib/subscriptions/pack-futbol.ts"

const root = resolve(import.meta.dirname, "..")

function read(path) {
  return readFileSync(resolve(root, path), "utf8")
}

test("TV Básica y TV Full son elegibles; sin TV o con pack activo no", () => {
  assert.equal(
    commercialTvTier({
      includedTvCode: "TV-BASICO",
      activeComponentCodes: [],
    }),
    "basica"
  )
  assert.equal(
    commercialTvTier({
      includedTvCode: "TV-BASICO",
      activeComponentCodes: ["TV-FULL-UPGRADE"],
    }),
    "full"
  )
  assert.equal(
    commercialTvTier({
      includedTvCode: "TV-FULL",
      activeComponentCodes: [],
    }),
    "none"
  )
  assert.equal(
    commercialTvTier({
      includedTvCode: "TV-BASICO-FUTBOL",
      activeComponentCodes: [],
    }),
    "none"
  )
  assert.equal(
    commercialTvTier({
      includedTvCode: null,
      activeComponentCodes: [],
    }),
    "none"
  )
  assert.equal(commercialTvTierLabel("basica"), "TV Básica")
  assert.equal(commercialTvTierLabel("full"), "TV Full")
  assert.equal(PACK_FUTBOL_CODE, "PACK-FUTBOL")

  assert.equal(
    canOfferPackFutbol({
      tier: "basica",
      packFutbolActive: false,
      packPrice: 3000,
    }),
    true
  )
  assert.equal(
    canOfferPackFutbol({
      tier: "full",
      packFutbolActive: false,
      packPrice: 3000,
    }),
    true
  )
  assert.equal(
    canOfferPackFutbol({
      tier: "basica",
      packFutbolActive: true,
      packPrice: 3000,
    }),
    false
  )
  assert.equal(
    canOfferPackFutbol({
      tier: "none",
      packFutbolActive: false,
      packPrice: 3000,
    }),
    false
  )
})

test("la cotización usa los importes del servidor y no los suma en el cliente", () => {
  const quoted = packFutbolQuotedFees({
    currentMonthlyFee: 39300,
    packPrice: 3000,
    nextMonthlyFee: 21150,
  })
  assert.equal(quoted.currentMonthlyFee, 39300)
  assert.equal(quoted.packMonthlyPrice, 3000)
  assert.equal(quoted.nextMonthlyFee, 21150)
  assert.notEqual(quoted.nextMonthlyFee, quoted.currentMonthlyFee + quoted.packMonthlyPrice)

  const available = interpretPackFutbolResponse({
    ok: true,
    success: true,
    status: "available",
    fallback: "error",
  })
  assert.equal(available.type, "available")
  assert.equal(available.refresh, false)
  assert.equal(canConfirmPackFutbol("available"), true)

  const active = interpretPackFutbolResponse({
    ok: true,
    success: true,
    status: "already_active",
    fallback: "error",
  })
  assert.equal(active.type, "already_active")
  assert.equal(active.refresh, true)
  assert.equal(canConfirmPackFutbol("already_active"), false)

  const assigned = interpretPackFutbolResponse({
    ok: true,
    success: true,
    status: "assigned",
    fallback: "error",
  })
  assert.equal(assigned.type, "assigned")
  assert.equal(assigned.refresh, true)
  assert.equal(canConfirmPackFutbol("assigned"), false)

  const failed = interpretPackFutbolResponse({
    ok: false,
    success: false,
    message: "No se pudo asignar Pack Fútbol.",
    fallback: "error genérico",
  })
  assert.deepEqual(failed, {
    type: "error",
    message: "No se pudo asignar Pack Fútbol.",
    refresh: false,
  })
})

test("la acción se ofrece en el abono, confirma por POST y refresca después", () => {
  const route = read("app/api/subscriptions/services/[serviceId]/pack-futbol/route.ts")
  const action = read("components/subscriptions/pack-futbol-action.tsx")
  const moduleUi = read("components/subscriptions/subscriptions-module.tsx")
  const desk = read("components/subscriptions/tv-commercial-desk-section.tsx")
  const queries = read("lib/supabase/subscriptions.queries.ts")
  const assignment = read("lib/isp/commercial-assignment.ts")
  const tier = read("lib/subscriptions/pack-futbol.ts")

  assert.match(route, /PACK_FUTBOL_CODE/)
  assert.match(route, /quoteComponentAssignment/)
  assert.match(route, /assignComponent/)
  assert.match(route, /already_active/)
  assert.ok(
    route.indexOf('quote.status === "already_active"') <
      route.indexOf("assignComponent")
  )
  assert.match(action, /Agregar Pack Fútbol/)
  assert.match(action, /Abono actual:/)
  assert.match(action, /Precio mensual de Pack Fútbol:/)
  assert.match(action, /Nuevo total mensual:/)
  assert.match(action, /packFutbolQuotedFees/)
  assert.match(action, /canConfirmPackFutbol/)
  assert.match(action, /interpretPackFutbolResponse/)
  assert.match(action, /method: "POST"/)
  assert.match(action, /submittingRef/)
  assert.match(action, /Este servicio ya tiene Pack Fútbol/)
  assert.match(action, /refreshDesk\(\)/)
  assert.match(action, /outcome\.message/)
  assert.doesNotMatch(action, /currentMonthlyFee\s*\+/)
  assert.doesNotMatch(action, /packPrice\s*\+/)
  assert.doesNotMatch(action, /calculateCommercialPrice/)
  assert.doesNotMatch(action, /packFutbolMonthlyPrice/)
  assert.doesNotMatch(action, /isp_service_components/)
  assert.doesNotMatch(action, /assignComponent/)

  const confirmStart = action.indexOf("async function confirm")
  const confirmBody = action.slice(confirmStart, action.indexOf("if (!canWrite"))
  assert.ok(confirmStart > 0)
  assert.ok(
    confirmBody.indexOf("canConfirmPackFutbol") <
      confirmBody.indexOf('method: "POST"')
  )
  assert.ok(
    confirmBody.indexOf('outcome.type === "error"') <
      confirmBody.indexOf("refreshDesk()")
  )

  assert.match(desk, /PackFutbolAction/)
  assert.match(action, /packFutbolEligible/)
  assert.match(desk, /packFutbolActive/)
  assert.match(desk, /Activo/)
  assert.doesNotMatch(moduleUi, /PackFutbolAction/)
  assert.doesNotMatch(moduleUi, /Agregar Pack Fútbol/)
  assert.doesNotMatch(desk, /assignComponent/)
  assert.doesNotMatch(desk, /isp_service_components/)
  assert.doesNotMatch(desk, /calculateCommercialPrice/)

  for (const source of [moduleUi, desk]) {
    assert.doesNotMatch(source, /isp_connections/)
  }

  for (const source of [route, action, queries, assignment, tier]) {
    assert.doesNotMatch(source, /isp_connections/)
    assert.doesNotMatch(source, /abnet/i)
  }
})
