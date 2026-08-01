import assert from "node:assert/strict"
import test from "node:test"

import {
  BUSINESS_INDICATOR_IDS,
  createBrief,
  createDigest,
  createSnapshot,
  snapshotEngine,
  validateBusinessDigest,
  validateBusinessSnapshot,
  validateExecutiveBrief,
  validatePipelineResult,
} from "../lib/indicator-engine/index.ts"

const NOW = "2026-08-01T15:00:00.000Z"

function companyContext() {
  return {
    companyId: "11111111-1111-4111-8111-111111111111",
    date: "2026-08-01",
    scope: "company",
    subjectId: null,
    version: "1.0.0",
    catalogVersion: "2.0.0-sprint2",
    metadata: { test: true },
    timeZone: "America/Argentina/Buenos_Aires",
  }
}

function sampleIndicators() {
  return {
    [BUSINESS_INDICATOR_IDS.EVENTS_TOTAL]: 12,
    [BUSINESS_INDICATOR_IDS.EMPLOYEES_ACTIVE]: 3,
    [BUSINESS_INDICATOR_IDS.WORKORDERS_STARTED]: 2,
    [BUSINESS_INDICATOR_IDS.WORKORDERS_FINISHED]: 1,
    [BUSINESS_INDICATOR_IDS.ATTENTIONS_CREATED]: 4,
    [BUSINESS_INDICATOR_IDS.ATTENTIONS_RESOLVED]: 2,
    [BUSINESS_INDICATOR_IDS.FIRST_EVENT_AT]: "2026-08-01T10:00:00.000Z",
    [BUSINESS_INDICATOR_IDS.LAST_EVENT_AT]: "2026-08-01T14:00:00.000Z",
    [BUSINESS_INDICATOR_IDS.ACTIVE_TIME_MS]: 14_400_000,
  }
}

test("Sprint 5: createSnapshot builds a complete in-memory BusinessSnapshot", () => {
  const snapshot = createSnapshot({
    context: companyContext(),
    indicators: sampleIndicators(),
    now: NOW,
  })

  assert.equal(validateBusinessSnapshot(snapshot).length, 0)
  assert.equal(snapshot.identity.scope, "company")
  assert.equal(snapshot.identity.subjectId, null)
  assert.equal(snapshot.payload.status, "ready")
  assert.equal(snapshot.payload.indicators.events_total, 12)
  assert.equal(snapshot.payload.timestamps.createdAt, NOW)
  assert.equal(snapshot.payload.updateMode, "bootstrap")
})

test("Sprint 5: createDigest uses consistent placeholder when items omitted", () => {
  const snapshot = createSnapshot({
    context: companyContext(),
    indicators: sampleIndicators(),
    now: NOW,
  })
  const digest = createDigest({ snapshot, now: NOW })

  assert.equal(validateBusinessDigest(digest).length, 0)
  assert.equal(digest.identity.companyId, snapshot.identity.companyId)
  assert.equal(digest.items.length, 1)
  assert.equal(digest.items[0].action, "snapshot.ready")
  assert.match(digest.items[0].title, /placeholder/i)
})

test("Sprint 5: createBrief joins snapshot + digest into Executive Brief V2", () => {
  const snapshot = createSnapshot({
    context: companyContext(),
    indicators: sampleIndicators(),
    now: NOW,
  })
  const digest = createDigest({ snapshot, now: NOW })
  const brief = createBrief({ snapshot, digest })

  assert.equal(validateExecutiveBrief(brief).length, 0)
  assert.equal(brief.date, "2026-08-01")
  assert.match(brief.narrative, /placeholder/i)
  assert.equal(brief.snapshot, snapshot)
  assert.equal(brief.digest, digest)
  assert.equal(brief.relevantActivity.length, 1)
  assert.equal(brief.firstEventAt, "2026-08-01T10:00:00.000Z")
  assert.equal(brief.activeTimeMs, 14_400_000)
  assert.ok(brief.generalState.some((m) => m.id === "events_total" && m.value === 12))
})

test("Sprint 5: snapshotEngine.build returns PipelineResult without I/O", () => {
  const { snapshot, digest, brief, result } = snapshotEngine.build({
    context: companyContext(),
    indicators: sampleIndicators(),
    now: NOW,
  })

  assert.equal(validatePipelineResult(result).length, 0)
  assert.equal(result.errors.length, 0)
  assert.equal(result.snapshot, snapshot)
  assert.equal(result.digest, digest)
  assert.equal(result.brief, brief)
  assert.equal(result.metadata.engine, "snapshot-engine.in-memory")
})

test("Sprint 5: employee scope requires subjectId in context", () => {
  assert.throws(() =>
    createSnapshot({
      context: {
        ...companyContext(),
        scope: "employee",
        subjectId: null,
      },
      indicators: sampleIndicators(),
      now: NOW,
    })
  )
})

test("Sprint 5: createBrief rejects mismatched digest identity", () => {
  const snapshot = createSnapshot({
    context: companyContext(),
    indicators: sampleIndicators(),
    now: NOW,
  })
  const digest = createDigest({ snapshot, now: NOW })
  const mismatched = {
    ...digest,
    identity: {
      ...digest.identity,
      subjectId: "22222222-2222-4222-8222-222222222222",
      scope: "employee",
    },
  }

  assert.throws(() => createBrief({ snapshot, digest: mismatched }))
})
