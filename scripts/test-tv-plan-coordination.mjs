import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { calculateCommercialPrice } from "../lib/isp/commercial-pricing.ts"
import {
  coordinateTvPlanChange,
  componentSyncPlan,
  createMemoryTvPlanAttempts,
  presentTvPlanPreview,
  quoteTvPlanDestination,
  resolveTvPlanCustomer,
  resolveTvPlanService,
} from "../lib/subscriptions/tv-plan-coordination.ts"

const root = resolve(import.meta.dirname, "..")

function read(path) {
  return readFileSync(resolve(root, path), "utf8")
}

function identity(overrides = {}) {
  return {
    source: "conex-internet-tv.xlsx",
    sourceRow: 12,
    abnetCustomerNumber: "6798",
    bespokeLink: "one",
    bespokeCustomerId: "customer-1",
    ...overrides,
  }
}

function service(overrides = {}) {
  return {
    serviceId: "service-1",
    includedTvCode: "TV-BASICO",
    listPrice: 39300,
    catalogMonthlyPrice: 40000,
    conditionCode: "JUBILADO",
    discountPercent: 50,
    activeComponents: [],
    catalogComponents: [
      { code: "PACK-FUTBOL", unitPrice: 3000, isRecurring: true },
      { code: "TV-FULL-UPGRADE", unitPrice: 5400, isRecurring: true },
    ],
    ...overrides,
  }
}

function fee(listPrice, components, discountPercent) {
  return calculateCommercialPrice({
    listPrice,
    discountPercent,
    components: components.map((item) => ({
      unitPrice: item.unitPrice,
      isRecurring: item.isRecurring,
      status: "active",
    })),
  }).monthlyFee
}

test("1-3. identidad, servicio y plan ambiguo bloquean antes de escribir", async () => {
  assert.equal(resolveTvPlanCustomer(identity({ bespokeLink: "none", bespokeCustomerId: null })).code, "missing_customer")
  assert.equal(resolveTvPlanCustomer(identity({ bespokeLink: "many", bespokeCustomerId: null })).code, "ambiguous_customer")
  assert.equal(resolveTvPlanCustomer(identity({ sourceRow: null })).code, "missing_identity")

  assert.equal(resolveTvPlanService([]).code, "missing_service")
  assert.equal(
    resolveTvPlanService([service({ includedTvCode: "TV-FULL", activeComponents: [] })]).code,
    "incompatible_service"
  )
  assert.equal(
    resolveTvPlanService([service(), service({ serviceId: "service-2" })]).code,
    "ambiguous_service"
  )

  const blocked = quoteTvPlanDestination({
    service: service(),
    kind: "full",
    latamAvailable: false,
  })
  assert.equal(blocked.selectable, false)
  assert.equal(blocked.padronAmount, null)

  const packAndFull = quoteTvPlanDestination({
    service: service({
      activeComponents: [{ code: "PACK-FUTBOL", unitPrice: 3000, isRecurring: true }],
    }),
    kind: "full",
    latamAvailable: true,
  })
  assert.equal(packAndFull.selectable, false)
  assert.match(packAndFull.blockReason, /no tiene un plan Full con Pack Fútbol/)
})

test("4. la cotización sale del servidor y no persiste importes", () => {
  const current = service({
    activeComponents: [{ code: "PACK-FUTBOL", unitPrice: 3000, isRecurring: true }],
  })
  const quoted = quoteTvPlanDestination({
    service: current,
    kind: "pack",
    latamAvailable: true,
  })
  assert.equal(quoted.currentMonthlyFee, fee(39300, current.activeComponents, 50))
  assert.equal(quoted.nextMonthlyFee, quoted.currentMonthlyFee)
  assert.deepEqual(
    quoted.actions.map((action) => action.type),
    ["keep"]
  )
  assert.equal(quoted.conditionCode, "JUBILADO")
  assert.equal(quoted.discountPercent, 50)
  assert.match(quoted.note, /no se convierte en la condición JUBILADO/)
  assert.equal(quoted.padronAmount, 7500)

  const preview = presentTvPlanPreview({
    services: [current],
    options: [
      { kind: "basica", label: "TV Básica", latamName: "Plan Basico", available: true },
      { kind: "pack", label: "TV Básica + Pack Fútbol", latamName: "Plan Basico + Pack Futbol", available: true },
      { kind: "full", label: "TV Full", latamName: "Plan Full", available: true },
    ],
  })
  assert.equal(preview.options.find((option) => option.kind === "full").selectable, false)
  assert.equal(preview.options.find((option) => option.kind === "pack").nextMonthlyFee, quoted.nextMonthlyFee)
})

test("5-8. rechazo, no verificado, fallo de Bespoke y recuperación sin repetir LATAM", async () => {
  const base = {
    attemptId: "attempt-1",
    companyId: "company-1",
    identity: identity(),
    services: [service()],
    kind: "pack",
    latamAvailable: true,
    targetPlanId: "pack-id",
    targetPlanName: "Plan Basico + Pack Futbol",
    now: "2026-10-10T00:00:00.000Z",
  }
  const expected = fee(39300, [{ code: "PACK-FUTBOL", unitPrice: 3000, isRecurring: true }], 50)

  async function run(changeOutcome, apply) {
    const store = createMemoryTvPlanAttempts()
    let latamReads = 0
    const calls = []
    const result = await coordinateTvPlanChange({
      ...base,
      store,
      readLatam: async () => {
        latamReads += 1
        if (latamReads === 1) return { found: true, planId: "basic-id", planName: "Plan Basico" }
        return { found: true, planId: "pack-id", planName: "Plan Basico + Pack Futbol" }
      },
      changeLatam: async () => {
        calls.push("latam")
        return changeOutcome
      },
      applyAction: async (action) => {
        calls.push(action.type)
        await apply(action)
      },
      readPersistedPrice: async () => ({
        priceSubtotal: 42300,
        discountAmount: 42300 - expected,
        monthlyFee: expected,
      }),
      updatePadron: async () => {
        calls.push("padron")
      },
    })
    return { result, calls, store }
  }

  const rejected = await run({ outcome: "rejected" }, async () => {})
  assert.equal(rejected.result.status, "latam_unconfirmed")
  assert.deepEqual(rejected.calls, ["latam"])
  assert.equal(rejected.result.bespokeWritten, false)

  const unverified = await run({ outcome: "unverified", planId: null, planName: null }, async () => {})
  assert.equal(unverified.result.status, "manual_review")
  assert.equal(unverified.result.error, "unverified")
  assert.deepEqual(unverified.calls, ["latam"])

  const failed = await run({ outcome: "updated", planId: "pack-id", planName: "Plan Basico + Pack Futbol" }, async () => {
    throw new Error("bespoke_failed")
  })
  assert.equal(failed.result.status, "latam_confirmed_bespoke_pending")
  assert.equal(failed.calls.filter((call) => call === "latam").length, 1)
  assert.equal(failed.store.rows()[0].bespokeStatus, "failed")

  const recovered = await coordinateTvPlanChange({
    ...base,
    store: failed.store,
    readLatam: async () => ({ found: true, planId: "pack-id", planName: "Plan Basico + Pack Futbol" }),
    changeLatam: async () => {
      throw new Error("modify-client no debe repetirse")
    },
    applyAction: async (action) => {
      assert.equal(action.type, "assign")
      assert.equal(action.code, "PACK-FUTBOL")
    },
    readPersistedPrice: async () => ({
      priceSubtotal: 42300,
      discountAmount: 42300 - expected,
      monthlyFee: expected,
    }),
    updatePadron: async (amount) => {
      assert.equal(amount, 7500)
    },
  })
  assert.equal(recovered.status, "completed")
  assert.equal(recovered.latamCalled, false)
})

test("9-10. conserva Full, Pack y condición, y no duplica componentes ni el abono", () => {
  const fullWithPack = service({
    activeComponents: [
      { code: "TV-FULL-UPGRADE", unitPrice: 5400, isRecurring: true },
      { code: "PACK-FUTBOL", unitPrice: 3000, isRecurring: true },
    ],
  })
  const toPack = quoteTvPlanDestination({
    service: fullWithPack,
    kind: "pack",
    latamAvailable: true,
  })
  assert.equal(toPack.conditionCode, "JUBILADO")
  assert.deepEqual(toPack.actions.map((action) => `${action.type}:${action.code}`), [
    "cancel:TV-FULL-UPGRADE",
    "keep:PACK-FUTBOL",
  ])
  assert.equal(
    toPack.nextMonthlyFee,
    fee(39300, [{ code: "PACK-FUTBOL", unitPrice: 3000, isRecurring: true }], 50)
  )
  assert.notEqual(
    toPack.nextMonthlyFee,
    fee(
      39300,
      [
        { code: "PACK-FUTBOL", unitPrice: 3000, isRecurring: true },
        { code: "PACK-FUTBOL", unitPrice: 3000, isRecurring: true },
      ],
      50
    )
  )

  const toFull = quoteTvPlanDestination({
    service: service(),
    kind: "full",
    latamAvailable: true,
  })
  assert.deepEqual(componentSyncPlan(service(), { fullUpgrade: true, pack: false }).map((action) => action.type), [
    "assign",
  ])
  assert.equal(toFull.nextComponentLabels.includes("TV-FULL-UPGRADE"), true)
  assert.equal(toFull.nextComponentLabels.includes("PACK-FUTBOL"), false)
  assert.equal(toFull.padronAmount, 9900)
})

test("11. la asignación independiente de Pack Fútbol sigue deshabilitada", () => {
  const route = read("app/api/subscriptions/services/[serviceId]/pack-futbol/route.ts")
  const plan = read("app/api/integrations/latam-tv/customers/[customerId]/plan/route.ts")
  assert.match(route, /isPackFutbolAssignmentEnabled/)
  assert.match(route, /status: 403/)
  assert.doesNotMatch(plan, /PACK_FUTBOL_ASSIGNMENT_ENABLED/)
  assert.doesNotMatch(plan, /assignComponent/)
  assert.doesNotMatch(plan, /isp_services/)
  assert.doesNotMatch(plan, /monthly_fee/)
})
