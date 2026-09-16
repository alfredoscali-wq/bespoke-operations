import assert from "node:assert/strict"
import test from "node:test"

import {
  mergeProjectDesignSourceIntoMetadata,
  readProjectDesignSourceMetadata,
} from "../lib/projects/design/ot-proposals.ts"
import {
  PROJECT_DESIGN_PLAN_SNAPSHOT_METADATA_KEY,
  PROJECT_DESIGN_SOURCE_METADATA_KEY,
  PROJECT_DESIGN_WORK_TYPE_METADATA_KEY,
  TENDIDO_EMPTY_SELECTION_MESSAGE,
  TENDIDO_NO_TRACES_MESSAGE,
  listSelectableTendidoSegments,
  listTendidoTraceOptions,
  mergeTendidoPlanIntoMetadata,
  resolveTendidoPlan,
  tendidoGainsForSegments,
} from "../lib/projects/design/tendido.ts"
import { buildProjectDesignSummary } from "../lib/projects/design/summary.ts"
import { OPERATIONAL_CHECKLIST_TEMPLATE_KEY } from "../lib/tasks/operational-checklist-template.ts"

const COMPANY_A = "00000000-0000-4000-8000-00000000000a"
const PROJECT_A = "11111111-1111-4111-8111-111111111111"
const PROJECT_B = "11111111-1111-4111-8111-111111111112"
const NODE_ID = "22222222-2222-4222-8222-222222222221"
const NAP_ID = "22222222-2222-4222-8222-222222222222"
const T01 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
const T02 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"
const T03 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3"
const T04 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4"
const T05 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5"
const DROP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"
const OTRO_ID = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1"
const FOREIGN_ID = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1"
const GAIN_T01 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1"
const GAIN_T02 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2"
const GAIN_T04 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee4"
const CAPTURED_AT = new Date("2026-09-14T12:00:00.000Z")

function element(overrides = {}) {
  return {
    id: NODE_ID,
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    kind: "node",
    name: "Node-01",
    latitude: -31.42,
    longitude: -64.18,
    notes: "",
    color: "#111827",
    icon: "square",
    gainM: 40,
    displayOrder: 0,
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
    ...overrides,
  }
}

function segment(overrides = {}) {
  return {
    id: T01,
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    originElementId: NODE_ID,
    destinationElementId: NAP_ID,
    name: "T-01",
    type: "tendido",
    cableReference: "",
    color: "#2563eb",
    notes: "",
    geometry: [
      { latitude: -31.42, longitude: -64.18 },
      { latitude: -31.43, longitude: -64.19 },
    ],
    plannedLengthM: 650,
    displayOrder: 0,
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
    ...overrides,
  }
}

function gain(overrides = {}) {
  return {
    id: GAIN_T01,
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    segmentId: T01,
    latitude: -31.425,
    longitude: -64.185,
    gainM: 10,
    observations: "",
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
    ...overrides,
  }
}

function acceptanceSnapshot() {
  return {
    elements: [
      element({ id: NODE_ID, kind: "node", name: "Node-01", gainM: 40 }),
      element({ id: NAP_ID, kind: "nap", name: "NAP-01", gainM: 25 }),
    ],
    segments: [
      segment({ id: T01, name: "T-01", plannedLengthM: 650, displayOrder: 0 }),
      segment({ id: T02, name: "T-02", plannedLengthM: 450, displayOrder: 1 }),
      segment({ id: T03, name: "T-03", plannedLengthM: 500, displayOrder: 2 }),
      segment({ id: T04, name: "T-04", plannedLengthM: 700, displayOrder: 3 }),
      segment({ id: T05, name: "T-05", plannedLengthM: 300, displayOrder: 4 }),
      segment({
        id: DROP_ID,
        name: "D-01",
        type: "drop",
        plannedLengthM: 80,
        displayOrder: 5,
      }),
      segment({
        id: OTRO_ID,
        name: "O-01",
        type: "otro",
        plannedLengthM: 120,
        displayOrder: 6,
      }),
      segment({
        id: FOREIGN_ID,
        name: "T-X",
        projectId: PROJECT_B,
        plannedLengthM: 999,
        displayOrder: 7,
      }),
    ],
    gains: [
      gain({ id: GAIN_T01, segmentId: T01, gainM: 10 }),
      gain({ id: GAIN_T02, segmentId: T02, gainM: 5 }),
      gain({ id: GAIN_T04, segmentId: T04, gainM: 8 }),
    ],
  }
}

function resolveAcceptance(segmentIds, capturedAt = CAPTURED_AT) {
  return resolveTendidoPlan({
    snapshot: acceptanceSnapshot(),
    projectId: PROJECT_A,
    segmentIds,
    capturedAt,
  })
}

test("1. una traza calcula metros y cable de esa traza", () => {
  const result = resolveAcceptance([T01])
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.plan.segments.length, 1)
  assert.equal(result.plan.plannedLengthM, 650)
  assert.equal(result.plan.traceGainM, 10)
  assert.equal(result.plan.plannedCableM, 660)
})

test("2. múltiples trazas se resuelven en una sola OT", () => {
  const result = resolveAcceptance([T01, T02, T03])
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(
    result.plan.source.segmentIds,
    [T01, T02, T03]
  )
  assert.equal(result.plan.segments.length, 3)
})

test("3. plannedLengthM suma planned_length_m de las trazas seleccionadas", () => {
  const result = resolveAcceptance([T01, T02, T03])
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.plan.plannedLengthM, 1600)
})

test("4. traceGainM suma solo gains de las trazas seleccionadas", () => {
  const snapshot = acceptanceSnapshot()
  const selected = tendidoGainsForSegments(snapshot.gains, [T01, T02, T03])
  assert.deepEqual(
    selected.map((item) => item.id),
    [GAIN_T01, GAIN_T02]
  )
  const result = resolveAcceptance([T01, T02, T03])
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.plan.traceGainM, 15)
  assert.equal(
    result.plan.gains.some((item) => item.segmentId === T04),
    false
  )
})

test("5. plannedCableM = plannedLengthM + traceGainM", () => {
  const result = resolveAcceptance([T01, T02, T03])
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.plan.plannedCableM, 1615)
  assert.equal(
    result.plan.plannedCableM,
    result.plan.plannedLengthM + result.plan.traceGainM
  )
})

test("6. Node/NAP gain no entra en el cable de Tendido", () => {
  const snapshot = acceptanceSnapshot()
  const summary = buildProjectDesignSummary(
    snapshot.elements,
    snapshot.segments.filter((item) =>
      [T01, T02, T03].includes(item.id)
    ),
    snapshot.gains.filter((item) =>
      [T01, T02, T03].includes(item.segmentId)
    )
  )
  assert.equal(summary.elementGainM, 65)
  assert.equal(summary.totalCableM, 1680)

  const result = resolveAcceptance([T01, T02, T03])
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.plan.plannedCableM, 1615)
  assert.notEqual(result.plan.plannedCableM, summary.totalCableM)
})

test("7. excluye segmentos drop", () => {
  const selectable = listSelectableTendidoSegments(
    acceptanceSnapshot(),
    PROJECT_A
  )
  assert.equal(selectable.some((item) => item.id === DROP_ID), false)
  const result = resolveAcceptance([DROP_ID])
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.code, "wrong-type")
})

test("8. excluye segmentos otro", () => {
  const selectable = listSelectableTendidoSegments(
    acceptanceSnapshot(),
    PROJECT_A
  )
  assert.equal(selectable.some((item) => item.id === OTRO_ID), false)
  const result = resolveAcceptance([OTRO_ID])
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.code, "wrong-type")
})

test("9. IDs inválidos no crean un plan parcial", () => {
  const result = resolveAcceptance([T01, "no-existe"])
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.code, "invalid-id")
})

test("10. IDs de otra Obra se rechazan", () => {
  const result = resolveAcceptance([FOREIGN_ID])
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.code, "wrong-project")
})

test("11. Diseño sin trazas de Tendido", () => {
  const snapshot = {
    elements: [element()],
    segments: [
      segment({ id: DROP_ID, type: "drop", name: "D-01" }),
    ],
    gains: [],
  }
  assert.deepEqual(listSelectableTendidoSegments(snapshot, PROJECT_A), [])
  assert.deepEqual(listTendidoTraceOptions(snapshot, PROJECT_A), [])
  assert.equal(TENDIDO_NO_TRACES_MESSAGE.includes("trazas de Tendido"), true)
})

test("12. selección vacía", () => {
  const result = resolveAcceptance([])
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.code, "empty-selection")
  assert.equal(result.message, TENDIDO_EMPTY_SELECTION_MESSAGE)
})

test("13. snapshot contiene IDs de trazas y gains", () => {
  const result = resolveAcceptance([T01, T02, T03])
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.plan.snapshot.segmentIds, [T01, T02, T03])
  assert.deepEqual(result.plan.snapshot.gainIds, [GAIN_T01, GAIN_T02])
  assert.deepEqual(
    result.plan.snapshot.segments.map((item) => item.id),
    [T01, T02, T03]
  )
})

test("14. snapshot contiene metros de planificación", () => {
  const result = resolveAcceptance([T01, T02, T03])
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.plan.snapshot.plannedLengthM, 1600)
  assert.equal(result.plan.snapshot.plannedCableM, 1615)
  assert.deepEqual(
    result.plan.snapshot.segments.map((item) => item.plannedLengthM),
    [650, 450, 500]
  )
})

test("15. snapshot contiene ganancias de trazas", () => {
  const result = resolveAcceptance([T01, T02, T03])
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.plan.snapshot.traceGainM, 15)
  assert.equal(result.plan.snapshot.workType, "tendido")
})

test("16. snapshot NO contiene geometry", () => {
  const result = resolveAcceptance([T01])
  assert.equal(result.ok, true)
  if (!result.ok) return
  const json = JSON.stringify(result.plan.snapshot)
  assert.equal(json.includes("geometry"), false)
  assert.equal("geometry" in result.plan.snapshot.segments[0], false)
  assert.deepEqual(Object.keys(result.plan.snapshot.segments[0]).sort(), [
    "id",
    "label",
    "plannedLengthM",
    "type",
  ])
})

test("17. reader acepta kind=segments", () => {
  const result = resolveAcceptance([T01, T02])
  assert.equal(result.ok, true)
  if (!result.ok) return
  const metadata = mergeTendidoPlanIntoMetadata({}, result.plan)
  const source = readProjectDesignSourceMetadata(metadata)
  assert.deepEqual(source, {
    kind: "segments",
    segmentIds: [T01, T02],
  })
  assert.equal(metadata[PROJECT_DESIGN_WORK_TYPE_METADATA_KEY], "tendido")
  assert.equal(
    metadata[PROJECT_DESIGN_SOURCE_METADATA_KEY].kind,
    "segments"
  )
  assert.equal(
    metadata[PROJECT_DESIGN_PLAN_SNAPSHOT_METADATA_KEY].capturedAt,
    CAPTURED_AT.toISOString()
  )
})

test("18. reader Node/NAP sigue funcionando", () => {
  const metadata = mergeProjectDesignSourceIntoMetadata({}, {
    id: "prop-nap",
    sourceElementId: NAP_ID,
    sourceElementKind: "nap",
    workType: "nap",
    designName: "NAP-01",
    designGainM: 10,
  })
  const source = readProjectDesignSourceMetadata(metadata)
  assert.deepEqual(source, {
    kind: "nap",
    elementId: NAP_ID,
    proposalId: "prop-nap",
    identifier: "NAP-01",
    plannedGainM: 10,
  })
})

test("19. metadata existente se preserva", () => {
  const result = resolveAcceptance([T04, T05])
  assert.equal(result.ok, true)
  if (!result.ok) return
  const existing = {
    [OPERATIONAL_CHECKLIST_TEMPLATE_KEY]: [
      { id: "chk-1", title: "Casco" },
    ],
    materialsNeeded: "cinta aisladora",
    customFlag: true,
  }
  const merged = mergeTendidoPlanIntoMetadata(existing, result.plan)
  assert.equal(merged.customFlag, true)
  assert.equal(merged.materialsNeeded, "cinta aisladora")
  assert.deepEqual(merged[OPERATIONAL_CHECKLIST_TEMPLATE_KEY], [
    { id: "chk-1", title: "Casco" },
  ])
  assert.equal(merged[PROJECT_DESIGN_WORK_TYPE_METADATA_KEY], "tendido")
  assert.equal(result.plan.plannedLengthM, 1000)
  assert.equal(result.plan.traceGainM, 8)
  assert.equal(result.plan.plannedCableM, 1008)
})

test("dos OTs de Tendido coexisten con cálculos independientes", () => {
  const first = resolveAcceptance([T01, T02, T03])
  const second = resolveAcceptance([T04, T05])
  assert.equal(first.ok, true)
  assert.equal(second.ok, true)
  if (!first.ok || !second.ok) return
  assert.equal(first.plan.plannedLengthM, 1600)
  assert.equal(second.plan.plannedLengthM, 1000)
  assert.notDeepEqual(
    first.plan.source.segmentIds,
    second.plan.source.segmentIds
  )
})
