/**
 * Sprint 36.0 — incremental detail refresh: local header patch + events only.
 */
import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  applyAtencionHeaderPatch,
  buildDeferAtencionPatch,
  buildInteractionAtencionPatch,
  buildResolveAtencionPatch,
  buildStartManagementAtencionPatch,
} from "../lib/customer-atenciones/detail-incremental-patch.ts"
import {
  beginAtcBreakdown,
  finalizeAtcBreakdown,
  getLastAtcBreakdownSnapshot,
  recordAtcBreakdownDetailMode,
  recordAtcBreakdownPhase,
  resetAtcBreakdownForTests,
} from "../lib/customer-service/performance/breakdown.ts"
import { setCustomerServicePerfEnabledForTests } from "../lib/customer-service/performance/enabled.ts"

const ROOT = process.cwd()

test("Sprint 36.0: refreshDetailPartial supports atencionPatch incremental mode", () => {
  const detail = readFileSync(
    join(ROOT, "components/atencion-cliente/atencion-detail-screen.tsx"),
    "utf8"
  )
  assert.ok(detail.includes("atencionPatch"))
  assert.ok(detail.includes("detailIncremental"))
  assert.ok(detail.includes("recordAtcBreakdownDetailMode"))
  assert.ok(detail.includes("buildStartManagementAtencionPatch"))
  assert.ok(detail.includes("buildDeferAtencionPatch"))
  assert.ok(detail.includes("buildResolveAtencionPatch"))
  assert.ok(detail.includes("buildInteractionAtencionPatch"))
  assert.ok(detail.includes("reloadAfterManagementSuccess"))

  const partialStart = detail.indexOf("const refreshDetailPartial = useCallback")
  const partialEnd = detail.indexOf("const reloadAfterAction = useCallback")
  const partialBlock = detail.slice(partialStart, partialEnd)
  assert.ok(partialBlock.includes("applyAtencionHeaderPatch"))
  assert.ok(partialBlock.includes('recordAtcBreakdownPhase("fetchAtencion", 0)'))
  assert.ok(partialBlock.includes('recordAtcBreakdownPhase("attachments", 0)'))
})

test("Sprint 36.0: patch helpers update status/owner without inventing unrelated fields", () => {
  const base = {
    id: "a1",
    companyId: "c1",
    customerId: "cu1",
    attendedByEmployeeId: "e0",
    channel: "telefono",
    motivo: "consulta",
    detail: "d",
    resolution: "",
    resultado: "pendiente",
    status: "para_resolver",
    nextStep: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }

  const started = buildStartManagementAtencionPatch({
    result: {
      atencionId: "a1",
      previousStatus: "para_resolver",
      newStatus: "en_gestion",
      previousNextStep: null,
      newNextStep: null,
    },
    employeeId: "emp-9",
  })
  const afterStart = applyAtencionHeaderPatch(base, started)
  assert.equal(afterStart.status, "en_gestion")
  assert.equal(afterStart.activeManagementEmployeeId, "emp-9")
  assert.ok(afterStart.activeManagementStartedAt)

  const deferred = buildDeferAtencionPatch({
    result: {
      atencionId: "a1",
      previousStatus: "en_gestion",
      newStatus: "pendiente",
      previousNextStep: null,
      newNextStep: "contactar_cliente",
    },
    detail: "Seguir mañana",
  })
  const afterDefer = applyAtencionHeaderPatch(afterStart, deferred)
  assert.equal(afterDefer.status, "pendiente")
  assert.equal(afterDefer.nextStep, "contactar_cliente")
  assert.equal(afterDefer.activeManagementEmployeeId, null)
  assert.equal(afterDefer.resolution, "Seguir mañana")

  const resolved = buildResolveAtencionPatch({
    result: {
      atencionId: "a1",
      previousStatus: "en_gestion",
      newStatus: "resuelta",
      previousNextStep: null,
      newNextStep: null,
    },
    resolution: "Listo",
    followUpActions: [],
    employeeId: "emp-9",
  })
  const afterResolve = applyAtencionHeaderPatch(afterStart, resolved)
  assert.equal(afterResolve.status, "resuelta")
  assert.equal(afterResolve.resolution, "Listo")
  assert.equal(afterResolve.activeManagementEmployeeId, null)

  const interaction = buildInteractionAtencionPatch({
    success: true,
    atencionId: "a1",
    eventId: "ev1",
    interactionKind: "contact",
    interactionResult: "ok",
    nextActionAt: null,
    status: "para_resolver",
    nextStep: null,
    managementReleased: true,
  })
  const afterInteraction = applyAtencionHeaderPatch(afterStart, interaction)
  assert.equal(afterInteraction.status, "para_resolver")
  assert.equal(afterInteraction.activeManagementEmployeeId, null)
})

test("Sprint 36.0: breakdown logs Detail Mode Incremental", async () => {
  setCustomerServicePerfEnabledForTests(true)
  resetAtcBreakdownForTests()
  const logs = []
  const originalInfo = console.info
  console.info = (...args) => {
    logs.push(args.map(String).join(" "))
  }

  const previousWindow = globalThis.window
  globalThis.window = {
    ...previousWindow,
    requestAnimationFrame: (cb) => {
      cb(0)
      return 0
    },
  }

  try {
    beginAtcBreakdown("start-management")
    recordAtcBreakdownDetailMode("incremental")
    recordAtcBreakdownPhase("rpc", 40)
    recordAtcBreakdownPhase("fetchAtencion", 0)
    recordAtcBreakdownPhase("fetchEvents", 80)
    recordAtcBreakdownPhase("loadDetail", 90)
    recordAtcBreakdownPhase("attachments", 0)
    await finalizeAtcBreakdown()

    const joined = logs.join("\n")
    assert.ok(joined.includes("[ATC Breakdown]"))
    assert.ok(joined.includes("Detail Mode"))
    assert.ok(joined.includes("Incremental"))
    assert.equal(getLastAtcBreakdownSnapshot()?.detailMode, "incremental")
    assert.equal(getLastAtcBreakdownSnapshot()?.attachmentsMs, 0)
    assert.equal(getLastAtcBreakdownSnapshot()?.fetchAtencionMs, 0)
  } finally {
    console.info = originalInfo
    globalThis.window = previousWindow
    setCustomerServicePerfEnabledForTests(null)
    resetAtcBreakdownForTests()
  }
})
