import assert from "node:assert/strict"
import test from "node:test"

import { buildExecutiveBrief } from "../lib/executive/build-executive-brief.ts"
import {
  computeIndicatorSnapshot,
  indicatorCount,
} from "../lib/indicators/compute.ts"
import { INDICATOR_IDS } from "../lib/indicators/catalog.ts"
import {
  createIndicatorFacade,
  indicatorFacade,
  resolveIndicatorFacadeBackend,
} from "../lib/indicator-engine/facade/index.ts"

const events = [
  {
    id: "1",
    module: "atencion",
    action: "attention.created",
    entityType: "customer_atencion",
    entityId: "a1",
    employeeId: "e1",
    createdAt: "2026-08-01T10:00:00.000Z",
    title: "Consulta",
    description: null,
    metadata: {},
  },
  {
    id: "2",
    module: "tasks",
    action: "workorder.finished",
    entityType: "task",
    entityId: "t1",
    employeeId: "e1",
    createdAt: "2026-08-01T12:00:00.000Z",
    title: "OT",
    description: null,
    metadata: {},
  },
]

test("Sprint 10 Facade: snapshot matches Indicator Engine 1.x", () => {
  const viaFacade = indicatorFacade.getSnapshot(events)
  const viaV1 = computeIndicatorSnapshot(events)

  assert.deepEqual(viaFacade.values, viaV1.values)
  assert.equal(
    indicatorFacade.indicatorCount(viaFacade, INDICATOR_IDS.EVENTS_TOTAL),
    indicatorCount(viaV1, INDICATOR_IDS.EVENTS_TOTAL)
  )
})

test("Sprint 10 Facade: executive brief matches IE 1.x / executive builder", () => {
  const input = {
    scope: { kind: "company" },
    date: "2026-08-01",
    events,
  }

  const viaFacade = indicatorFacade.getExecutiveBrief(input)
  const viaV1 = buildExecutiveBrief(input)

  assert.equal(viaFacade.narrative, viaV1.narrative)
  assert.deepEqual(viaFacade.generalState, viaV1.generalState)
  assert.deepEqual(viaFacade.production, viaV1.production)
  assert.deepEqual(viaFacade.relevantActivity, viaV1.relevantActivity)
  assert.deepEqual(viaFacade.snapshot.values, viaV1.snapshot.values)
})

test("Sprint 10 Facade: digest is relevant activity from the same brief path", () => {
  const input = {
    scope: { kind: "company" },
    date: "2026-08-01",
    events,
  }

  const brief = indicatorFacade.getExecutiveBrief(input)
  const digest = indicatorFacade.getDigest(input)

  assert.deepEqual(digest.items, brief.relevantActivity)
  assert.ok(digest.limit > 0)
})

test("Sprint 10 Facade: v2/dual config still resolves to v1 (structure only)", () => {
  assert.equal(resolveIndicatorFacadeBackend({ backend: "v1" }), "v1")
  assert.equal(resolveIndicatorFacadeBackend({ backend: "v2" }), "v1")
  assert.equal(resolveIndicatorFacadeBackend({ backend: "dual" }), "v1")

  const dualFacade = createIndicatorFacade({
    backend: "dual",
    features: { enableShadow: true, enableComparator: true },
  })

  const snapshot = dualFacade.getSnapshot(events)
  assert.deepEqual(snapshot.values, computeIndicatorSnapshot(events).values)
  assert.equal(dualFacade.config.backend, "dual")
})

test("Sprint 10 Facade: empty snapshot helper matches IE 1.x", () => {
  const empty = indicatorFacade.getEmptySnapshot()
  const viaV1 = computeIndicatorSnapshot([])
  assert.deepEqual(empty.values, viaV1.values)
  assert.equal(empty.values.events_total, 0)
})
