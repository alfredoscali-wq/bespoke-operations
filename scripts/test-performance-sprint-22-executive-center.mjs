import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  buildAttentionItems,
  buildDecisionItems,
  buildDomainCards,
  buildExecutiveCenterReadModel,
  buildWinItems,
  prepareExecutiveCenterExport,
} from "../lib/analysis/executive-center/index.ts"
import { analysisQueryKeys } from "../lib/analysis/react-query/keys.ts"
import { INDICATOR_IDS } from "../lib/indicators/catalog.ts"

const ROOT = process.cwd()

function briefWithValues(values) {
  return {
    scope: { kind: "company", label: "Empresa" },
    date: "2026-08-01",
    narrative: "La empresa: 4 empleados con actividad. 6 OT ejecutadas.",
    generalState: [],
    production: [],
    operationalAlerts: [],
    relevantActivity: [],
    snapshot: { values },
    firstEventAt: null,
    lastEventAt: null,
    activeTimeMs: 0,
  }
}

test("Sprint 22: builds executive center from brief with priority attention", () => {
  const brief = briefWithValues({
    [INDICATOR_IDS.WORKORDERS_STARTED]: 20,
    [INDICATOR_IDS.WORKORDERS_FINISHED]: 6,
    [INDICATOR_IDS.ATTENTIONS_CREATED]: 30,
    [INDICATOR_IDS.ATTENTIONS_RESOLVED]: 10,
    [INDICATOR_IDS.WORKORDERS_RESCHEDULED]: 4,
    [INDICATOR_IDS.REQUESTS_CREATED]: 5,
    [INDICATOR_IDS.REQUESTS_RESOLVED]: 1,
    [INDICATOR_IDS.CREWS_ACTIVE]: 3,
  })

  const model = buildExecutiveCenterReadModel({
    date: "2026-08-01",
    brief,
  })

  assert.equal(model.date, "2026-08-01")
  assert.ok(model.attention.length > 0)
  assert.equal(model.attention[0].severity, "critical")
  assert.ok(model.attention[0].href.length > 0)
  assert.equal(model.domains.length, 5)
  assert.ok(model.decisions.length > 0)
  assert.ok(model.decisions[0].recommendation.includes("Conviene") || model.decisions[0].recommendation.length > 10)
})

test("Sprint 22: wins are positive-only and decisions use business rules", () => {
  const brief = briefWithValues({
    [INDICATOR_IDS.WORKORDERS_STARTED]: 10,
    [INDICATOR_IDS.WORKORDERS_FINISHED]: 10,
    [INDICATOR_IDS.WORKORDERS_CANCELLED]: 0,
    [INDICATOR_IDS.ATTENTIONS_CREATED]: 10,
    [INDICATOR_IDS.ATTENTIONS_RESOLVED]: 10,
    [INDICATOR_IDS.CREWS_ACTIVE]: 4,
  })

  const wins = buildWinItems(brief)
  assert.ok(wins.length >= 2)
  assert.ok(wins.some((win) => win.title.includes("100 %") || win.title.includes("completaron")))

  const attention = buildAttentionItems(brief)
  const decisions = buildDecisionItems(brief, attention)
  assert.ok(decisions.length >= 1)
  assert.equal(decisions.some((d) => d.recommendation.includes("GPT")), false)
})

test("Sprint 22: domain cards cover five executive areas", () => {
  const cards = buildDomainCards(
    briefWithValues({
      [INDICATOR_IDS.ATTENTIONS_CREATED]: 2,
      [INDICATOR_IDS.ATTENTIONS_RESOLVED]: 2,
    })
  )
  assert.deepEqual(
    cards.map((card) => card.id),
    ["attention", "operations", "planning", "commercial", "administration"]
  )
})

test("Sprint 22: export stubs not ready", () => {
  const model = buildExecutiveCenterReadModel({
    date: "2026-08-01",
    brief: briefWithValues({}),
  })
  for (const format of /** @type {const} */ (["pdf", "share", "print"])) {
    const result = prepareExecutiveCenterExport({ format, model })
    assert.equal(result.ready, false)
  }
})

test("Sprint 22: React Query key + nav first + no Activity Engine in UI", () => {
  assert.deepEqual(analysisQueryKeys.executiveCenter("2026-08-01"), [
    "analysis",
    "executive-center",
    "2026-08-01",
  ])

  const nav = readFileSync(
    join(ROOT, "lib/navigation/build-nav-from-modules.ts"),
    "utf8"
  )
  const orderMatch = nav.match(
    /ANALYSIS_NAV_ORDER[\s\S]*?executiveCenterNavItem\.href/
  )
  assert.ok(orderMatch)

  const moduleSource = readFileSync(
    join(ROOT, "components/activity/executive-center-module.tsx"),
    "utf8"
  )
  assert.ok(moduleSource.includes("useExecutiveCenterQuery"))
  assert.equal(moduleSource.includes("getActivityEvents"), false)
  assert.equal(moduleSource.includes("from(\"tasks\")"), false)

  const loader = readFileSync(
    join(ROOT, "lib/analysis/executive-center/load-read-model.server.ts"),
    "utf8"
  )
  assert.ok(loader.includes("loadSituationRoomViaDualRead"))
  assert.ok(loader.includes("buildExecutiveCenterReadModel"))
})
