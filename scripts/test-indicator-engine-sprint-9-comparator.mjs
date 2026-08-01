import assert from "node:assert/strict"
import test from "node:test"

import {
  buildComparisonReport,
  compareDigests,
  compareExecutiveBriefs,
  compareSnapshots,
} from "../lib/indicator-engine/index.ts"

const NOW = "2026-08-01T20:00:00.000Z"

function legacySnapshot(values) {
  return { values }
}

function businessSnapshot(indicators, status = "ready") {
  return {
    identity: {
      companyId: "c1",
      date: "2026-08-01",
      scope: "company",
      subjectId: null,
      version: "1.0.0",
    },
    payload: {
      indicators,
      status,
      timestamps: {
        createdAt: NOW,
        updatedAt: NOW,
        calculatedAt: NOW,
      },
      metadata: { technical: true },
      version: "2.0.0",
      updateMode: "bootstrap",
    },
  }
}

function digestItems(items) {
  return items.map((item, index) => ({
    id: `uuid-${index}`,
    createdAt: NOW,
    employeeId: "emp-ignored",
    ...item,
  }))
}

test("Sprint 9: identical indicator maps match (order-independent)", () => {
  const result = compareSnapshots(
    legacySnapshot({ events_total: 3, attentions_created: 1 }),
    businessSnapshot({ attentions_created: 1, events_total: 3 })
  )

  assert.equal(result.match, true)
  assert.equal(result.differences.length, 0)
  assert.equal(result.missing.length, 0)
  assert.equal(result.unexpected.length, 0)
  assert.ok(result.coverage.ratio === 1)
})

test("Sprint 9: missing indicator", () => {
  const result = compareSnapshots(
    legacySnapshot({ events_total: 3, attentions_created: 1 }),
    businessSnapshot({ events_total: 3 })
  )

  assert.equal(result.match, false)
  assert.equal(result.missing.length, 1)
  assert.equal(result.missing[0].path, "indicators.attentions_created")
})

test("Sprint 9: different indicator value", () => {
  const result = compareSnapshots(
    legacySnapshot({ events_total: 3 }),
    businessSnapshot({ events_total: 9 })
  )

  assert.equal(result.match, false)
  assert.equal(result.differences.length, 1)
  assert.equal(result.differences[0].expected, 3)
  assert.equal(result.differences[0].actual, 9)
})

test("Sprint 9: unexpected indicator on next engine", () => {
  const result = compareSnapshots(
    legacySnapshot({ events_total: 1 }),
    businessSnapshot({ events_total: 1, retentions: 2 })
  )

  assert.equal(result.match, false)
  assert.equal(result.unexpected.length, 1)
  assert.equal(result.unexpected[0].path, "indicators.retentions")
})

test("Sprint 9: digest differs by business content (ignores UUID/timestamps)", () => {
  const legacy = {
    items: [
      {
        action: "attention.resolved",
        title: "Consulta resuelta",
        description: null,
        entityType: "customer_atencion",
        entityId: "att-1",
      },
    ],
  }

  const sameBusinessDifferentIds = {
    items: digestItems([
      {
        action: "attention.resolved",
        title: "Consulta resuelta",
        description: null,
        entityType: "customer_atencion",
        entityId: "att-1",
      },
    ]),
  }

  assert.equal(compareDigests(legacy, sameBusinessDifferentIds).match, true)

  const differentTitle = {
    items: digestItems([
      {
        action: "attention.resolved",
        title: "Otro título",
        description: null,
        entityType: "customer_atencion",
        entityId: "att-1",
      },
    ]),
  }

  const digestDiff = compareDigests(legacy, differentTitle)
  assert.equal(digestDiff.match, false)
  assert.ok(digestDiff.missing.length + digestDiff.unexpected.length >= 1)
})

test("Sprint 9: brief narrative / empty dataset report", () => {
  const emptyLegacyBrief = {
    date: "2026-08-01",
    narrative: "Sin actividad.",
    generalState: [],
    production: [],
    operationalAlerts: [],
    relevantActivity: [],
    snapshot: { values: {} },
    firstEventAt: null,
    lastEventAt: null,
    activeTimeMs: 0,
  }

  const emptyNextBrief = {
    identity: {
      companyId: "c1",
      date: "2026-08-01",
      scope: "company",
      subjectId: null,
      version: "1",
    },
    date: "2026-08-01",
    narrative: "Sin actividad.",
    generalState: [],
    production: [],
    operationalAlerts: [],
    relevantActivity: [],
    snapshot: businessSnapshot({}),
    digest: {
      identity: {
        companyId: "c1",
        date: "2026-08-01",
        scope: "company",
        subjectId: null,
        version: "1",
      },
      items: [],
      limit: 20,
      updatedAt: NOW,
      version: "1",
    },
    firstEventAt: null,
    lastEventAt: null,
    activeTimeMs: 0,
  }

  const identical = compareExecutiveBriefs(emptyLegacyBrief, emptyNextBrief)
  assert.equal(identical.match, true)

  const differentNarrative = compareExecutiveBriefs(emptyLegacyBrief, {
    ...emptyNextBrief,
    narrative: "Otra narrativa.",
  })
  assert.equal(differentNarrative.match, false)
  assert.ok(
    differentNarrative.differences.some((d) => d.path === "narrative")
  )

  const report = buildComparisonReport({
    legacySnapshot: { values: {} },
    nextSnapshot: businessSnapshot({}),
    legacyDigest: { items: [] },
    nextDigest: { items: [] },
    legacyBrief: emptyLegacyBrief,
    nextBrief: emptyNextBrief,
    now: NOW,
  })

  assert.equal(report.match, true)
  assert.equal(report.generatedAt, NOW)
  assert.ok(report.comparisonTimeMs >= 0)
  assert.equal(report.coverage.ratio, 1)
})

test("Sprint 9: never throws on malformed input", () => {
  assert.doesNotThrow(() => {
    compareSnapshots(null, null)
    compareDigests(null, null)
    compareExecutiveBriefs(null, null)
    buildComparisonReport({
      legacySnapshot: null,
      nextSnapshot: null,
      legacyDigest: null,
      nextDigest: null,
      legacyBrief: null,
      nextBrief: null,
    })
  })
})
