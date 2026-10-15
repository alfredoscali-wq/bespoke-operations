import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  BESPOKE_OT_TV_PADRON_SOURCE,
  contractedPlanIncludesTv,
  countPendingTvOtSignups,
  countTvOtSignups,
  matchPadronIdentity,
  planTvOtSignupExclusion,
  planTvOtSignupIncorporation,
  planTvOtSignupPlanEdit,
  presentTvOtSignup,
  suggestedTvKind,
  TV_OT_LATAM_STATUS,
  verifiedAbnetNumber,
} from "../lib/subscriptions/tv-ot-signups.ts"

const root = resolve(import.meta.dirname, "..")

function read(path) {
  return readFileSync(resolve(root, path), "utf8")
}

function fact(overrides = {}) {
  return {
    taskId: "task-1",
    taskCode: "TSK-OT-1225",
    taskCreatedAt: "2026-10-06T15:00:00.000Z",
    taskStatus: "finalizada",
    contractedPlan: "FTTH-300-TV-BASICO",
    customerId: "customer-1",
    customerNumber: "CLI-005814",
    customerName: "Cliente Ejemplo",
    customerStatus: "activo",
    abnetNumber: null,
    activationPreviousStatus: "pendiente-activacion",
    padronExact: null,
    possibleMatchNumbers: [],
    proposal: null,
    ...overrides,
  }
}

function item(overrides = {}) {
  const presented = presentTvOtSignup(fact(overrides))
  assert.ok(presented)
  return presented
}

test("clasifica la aprobación por CUSTOMER_ACTIVATE desde pendiente de activación", () => {
  assert.equal(item().category, "approved_with_tv")
  assert.equal(item().activationLabel, "Aprobada desde pendiente de activación")
  assert.equal(item({ contractedPlan: "300Mb" }).category, "approved_without_tv")
  assert.equal(item({ contractedPlan: "300Mb" }).suggestedTvKind, null)
  assert.equal(item({ contractedPlan: "300Mb" }).proposedPlanLabel, "Sin propuesta")
  assert.equal(
    item({ activationPreviousStatus: null }).category,
    "active_unverified"
  )
  assert.equal(
    item({ customerStatus: "pendiente-activacion", activationPreviousStatus: "pendiente-activacion" }).category,
    "pending_activation"
  )
  assert.equal(item({ taskStatus: "cancelada" }).category, "cancelled")
  assert.equal(item({ taskStatus: "programada", activationPreviousStatus: null }).taskOpen, true)
  assert.equal(suggestedTvKind("FTTH-300-TV-BASICO"), "basica")
  assert.equal(suggestedTvKind("WIRELESS-20-TV-BASICO"), "basica")
  assert.equal(contractedPlanIncludesTv("300Mb"), false)
})

test("un nombre parecido no asigna el N° ABNet ni se toma como coincidencia exacta", () => {
  const matched = matchPadronIdentity({
    abnetNumber: null,
    customerName: "Rocha Ricardo",
    rows: [
      {
        number: "5959",
        name: "Rocha Ricardo",
        planName: "TV",
        tvAmount: 4500,
        source: "conex-internet-tv.xlsx",
        sourceRow: 10,
      },
    ],
  })
  assert.equal(matched.exact, null)
  assert.deepEqual(matched.possibleMatchNumbers, ["5959"])
  const row = item({ possibleMatchNumbers: ["5959"] })
  assert.equal(row.abnetNumber, null)
  assert.equal(row.possibleMatch, true)
  assert.equal(row.padronPresence, "none")
  assert.equal(verifiedAbnetNumber("00006825"), "6825")
  assert.equal(verifiedAbnetNumber("0"), null)
  assert.equal(verifiedAbnetNumber("ABC"), null)
})

test("la exclusión oculta ese caso y no el de otra OT del mismo cliente", () => {
  assert.equal(
    presentTvOtSignup(fact({ proposal: { status: "excluded", tvKind: null, excludedAt: "2026-10-15T12:00:00.000Z", excludedBy: "user-1", incorporatedAt: null, incorporatedBy: null, padronSource: null, padronSourceRow: null } })),
    null
  )
  const other = item({ taskId: "task-2", taskCode: "TSK-OT-2000" })
  assert.equal(other.taskId, "task-2")
  assert.equal(planTvOtSignupExclusion({ proposalStatus: "excluded", incorporated: false }).outcome, "already_excluded")
  assert.equal(planTvOtSignupExclusion({ proposalStatus: "pending_review", incorporated: false }).outcome, "exclude")
  assert.equal(planTvOtSignupExclusion({ proposalStatus: "incorporated", incorporated: true }).outcome, "rejected")
})

test("sin N° ABNet no hay inserción al padrón y un número ya presente no se duplica", () => {
  const saved = item({
    proposal: {
      status: "pending_review",
      tvKind: "basica",
      excludedAt: null,
      excludedBy: null,
      incorporatedAt: null,
      incorporatedBy: null,
      padronSource: null,
      padronSourceRow: null,
    },
  })
  const missing = planTvOtSignupIncorporation({
    item: saved,
    customerName: "Cliente Ejemplo",
    acknowledgePossibleMatch: false,
  })
  assert.equal(missing.outcome, "missing_abnet")
  assert.equal("abnetNumber" in missing, false)

  const numbered = item({
    abnetNumber: "6825",
    proposal: saved.selectedTvKind
      ? {
          status: "pending_review",
          tvKind: "basica",
          excludedAt: null,
          excludedBy: null,
          incorporatedAt: null,
          incorporatedBy: null,
          padronSource: null,
          padronSourceRow: null,
        }
      : null,
  })
  const ready = planTvOtSignupIncorporation({
    item: numbered,
    customerName: "Cliente Ejemplo",
    acknowledgePossibleMatch: false,
  })
  assert.equal(ready.outcome, "insert")
  assert.equal(ready.abnetNumber, "6825")
  assert.equal(ready.planName, "TV Básica")
  assert.notEqual(ready.tvAmount, null)

  const present = item({
    abnetNumber: "6825",
    padronExact: { source: "conex-internet-tv.xlsx", sourceRow: 4, planLabel: "TV Básica" },
    proposal: {
      status: "pending_review",
      tvKind: "basica",
      excludedAt: null,
      excludedBy: null,
      incorporatedAt: null,
      incorporatedBy: null,
      padronSource: null,
      padronSourceRow: null,
    },
  })
  assert.equal(present.category, "incorporated")
  assert.equal(
    planTvOtSignupIncorporation({
      item: present,
      customerName: "Cliente Ejemplo",
      acknowledgePossibleMatch: false,
    }).outcome,
    "rejected"
  )
})

test("editar el plan no cambia el contrato y una OT cancelada no se incorpora", () => {
  const row = item()
  const edited = planTvOtSignupPlanEdit({ item: row, tvKind: "full" })
  assert.equal(edited.outcome, "save")
  assert.equal(edited.tvKind, "full")
  assert.equal(row.contractedPlan, "FTTH-300-TV-BASICO")
  assert.equal(planTvOtSignupPlanEdit({ item: row, tvKind: "premium" }).outcome, "rejected")
  const cancelled = item({ taskStatus: "cancelada" })
  assert.equal(cancelled.canIncorporate, false)
  assert.equal(
    planTvOtSignupIncorporation({
      item: cancelled,
      customerName: "Cliente Ejemplo",
      acknowledgePossibleMatch: false,
    }).outcome,
    "rejected"
  )
})

test("la coincidencia de nombre exige revisión y Latam queda fuera", () => {
  const row = item({
    possibleMatchNumbers: ["5959"],
    proposal: {
      status: "pending_review",
      tvKind: "basica",
      excludedAt: null,
      excludedBy: null,
      incorporatedAt: null,
      incorporatedBy: null,
      padronSource: null,
      padronSourceRow: null,
    },
  })
  assert.equal(
    planTvOtSignupIncorporation({
      item: row,
      customerName: "Cliente Ejemplo",
      acknowledgePossibleMatch: false,
    }).outcome,
    "needs_review"
  )
  assert.equal(row.latamStatus, TV_OT_LATAM_STATUS)
  const files = [
    "app/api/subscriptions/tv-ot-signups/route.ts",
    "app/api/subscriptions/tv-ot-signups/[taskId]/route.ts",
    "app/api/subscriptions/tv-ot-signups/[taskId]/incorporate/route.ts",
    "app/api/subscriptions/tv-ot-signups/[taskId]/exclude/route.ts",
    "lib/subscriptions/tv-ot-signups.ts",
    "lib/subscriptions/tv-ot-signups-actions.ts",
    "lib/subscriptions/tv-ot-signups-store.ts",
    "components/subscriptions/tv-ot-signups-panel.tsx",
  ]
  for (const file of files) {
    const source = read(file)
    assert.doesNotMatch(source, /latam-tv|changeLatamClientPlan|sync-client/)
  }
  assert.match(read("app/api/subscriptions/tv-ot-signups/route.ts"), /requireSubscriptionsReadContext/)
  assert.match(read("app/api/subscriptions/tv-ot-signups/[taskId]/incorporate/route.ts"), /requireSubscriptionsWriteContext/)
  assert.match(read("lib/subscriptions/tv-ot-signups-store.ts"), /BESPOKE_OT_TV_PADRON_SOURCE|bespoke-ot-tv/)
  assert.equal(BESPOKE_OT_TV_PADRON_SOURCE, "bespoke-ot-tv")
  const migration = read("supabase/migrations/20270115140000_tv_ot_signup_proposals.sql")
  assert.match(migration, /tv_ot_signup_proposals_case_unique/)
  assert.match(migration, /status = 'excluded'/)
  assert.doesNotMatch(migration, /DROP NOT NULL|abnet_customer_number DROP/)
  assert.equal(countTvOtSignups([row]).approved_with_tv, 1)
  assert.equal(countPendingTvOtSignups([row, { category: "incorporated" }]), 1)
  const overview = read("components/subscriptions/subscriptions-tv-overview.tsx")
  const screen = read("components/subscriptions/subscriptions-module.tsx")
  assert.match(overview, /Altas pendientes en TV/)
  assert.match(overview, /showConsultas/)
  assert.match(overview, /showPendingSignups/)
  assert.match(overview, /onTogglePendingSignups/)
  assert.match(screen, /useState\(false\)/)
  assert.match(screen, /pendingSignupsOpen && showPendingSignups/)
  assert.equal(screen.split("<TvOtSignupsPanel").length - 1, 1)
})
