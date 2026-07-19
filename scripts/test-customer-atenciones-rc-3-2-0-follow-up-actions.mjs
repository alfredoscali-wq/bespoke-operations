/**
 * RC 3.2.0 — post-resolution follow-up actions + OT por generar KPI.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  CONSULTATION_FOLLOW_UP_ACTION_OPTIONS,
  formatResolveEventDetail,
  formatResolveFollowUpClosingNote,
  normalizeConsultationFollowUpActions,
  parseResolveEventDetail,
  validateConsultationFollowUpActions,
} from "../lib/customer-atenciones/consultation-follow-up.ts"
import {
  computeOperationalWorkCounts,
  filterSharedInboxRows,
  matchesOperationalCategory,
} from "../lib/customer-atenciones/shared-inbox.ts"

function inboxRow(overrides = {}) {
  return {
    id: "1",
    customerId: "c1",
    customerName: "Cliente",
    channel: "telefono",
    motivo: "otro",
    detail: "Detalle",
    status: "para_resolver",
    nextStep: "generar_ot",
    attendedByEmployeeId: "e1",
    attendedByEmployeeName: "Empleado",
    activeManagementEmployeeId: null,
    activeManagementEmployeeName: null,
    activeManagementStartedAt: null,
    linkedTaskId: null,
    linkedTaskCode: null,
    followUpActions: [],
    createdAt: "2026-07-18T10:00:00.000Z",
    updatedAt: "2026-07-18T10:00:00.000Z",
    ...overrides,
  }
}

test("follow-up catalog is extensible and includes generar_ot", () => {
  assert.ok(CONSULTATION_FOLLOW_UP_ACTION_OPTIONS.length >= 1)
  assert.equal(
    CONSULTATION_FOLLOW_UP_ACTION_OPTIONS[0]?.id,
    "generar_ot"
  )
  assert.deepEqual(normalizeConsultationFollowUpActions(["generar_ot", "x"]), [
    "generar_ot",
  ])
  assert.deepEqual(validateConsultationFollowUpActions(["generar_ot"]), [
    "generar_ot",
  ])
  assert.equal(
    typeof validateConsultationFollowUpActions(["nope"]),
    "object"
  )
})

test("resolve event detail bakes follow-up into the same management note", () => {
  const detail = formatResolveEventDetail("Cliente informado", ["generar_ot"])
  const parsed = parseResolveEventDetail(detail)
  assert.equal(parsed.resolution, "Cliente informado")
  assert.deepEqual(parsed.followUpActions, ["generar_ot"])
  assert.match(
    formatResolveFollowUpClosingNote(["generar_ot"]) ?? "",
    /Orden de Trabajo/
  )
})

test("KPI OT por generar includes open next_step and resolved follow-up", () => {
  const openOt = inboxRow({ id: "open", status: "para_resolver", nextStep: "generar_ot" })
  const resolvedOt = inboxRow({
    id: "resolved",
    status: "resuelta",
    nextStep: null,
    followUpActions: ["generar_ot"],
  })
  const resolvedPlain = inboxRow({
    id: "done",
    status: "resuelta",
    nextStep: null,
    followUpActions: [],
  })

  assert.equal(matchesOperationalCategory(openOt, "generar_ot"), true)
  assert.equal(matchesOperationalCategory(resolvedOt, "generar_ot"), true)
  assert.equal(matchesOperationalCategory(resolvedPlain, "generar_ot"), false)

  const counts = computeOperationalWorkCounts([openOt, resolvedOt, resolvedPlain])
  assert.equal(counts.generar_ot, 2)

  const filtered = filterSharedInboxRows([openOt, resolvedOt, resolvedPlain], {
    statusFilter: "all",
    operationalCategory: "generar_ot",
  })
  assert.deepEqual(
    filtered.map((row) => row.id).sort(),
    ["open", "resolved"]
  )
})

test("resolved follow-up does not appear in operational trays", () => {
  const resolvedOt = inboxRow({
    id: "resolved",
    status: "resuelta",
    nextStep: null,
    followUpActions: ["generar_ot"],
  })
  const filtered = filterSharedInboxRows([resolvedOt], {
    statusFilter: "all",
    workTray: "tecnica",
  })
  assert.equal(filtered.length, 0)
})
