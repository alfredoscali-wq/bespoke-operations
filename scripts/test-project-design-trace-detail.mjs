import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { formatGainMeters, formatPlannedLengthMeters } from "../lib/gps/distance.ts"
import { buildProjectDesignSummary } from "../lib/projects/design/summary.ts"
import {
  PROJECT_DESIGN_UNDEFINED_ENDPOINT,
  PROJECT_DESIGN_UNSPECIFIED_CABLE,
  buildProjectDesignTraceDetail,
  buildTendidoOtTracesView,
} from "../lib/projects/design/trace-detail.ts"

const COMPANY_A = "00000000-0000-4000-8000-00000000000a"
const PROJECT_A = "11111111-1111-4111-8111-111111111111"
const NODE_ID = "22222222-2222-4222-8222-222222222221"
const NAP_02 = "22222222-2222-4222-8222-222222222222"
const NAP_03 = "22222222-2222-4222-8222-222222222223"
const NAP_04 = "22222222-2222-4222-8222-222222222224"
const T01 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
const T02 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"
const T03 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3"
const MISSING = "ffffffff-ffff-4fff-8fff-ffffffffffff"

const INSPECTOR_PATH = join(
  process.cwd(),
  "components/obras/design/project-design-inspector.tsx"
)
const CANVAS_PATH = join(
  process.cwd(),
  "components/obras/design/project-design-map-canvas.tsx"
)
const OT_SECTION_PATH = join(
  process.cwd(),
  "components/obras/project-design-tendido-ot-traces-section.tsx"
)

function element(overrides = {}) {
  return {
    id: NODE_ID,
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    kind: "nap",
    name: "NAP-02",
    latitude: -31.42,
    longitude: -64.18,
    notes: "",
    color: "#2563eb",
    icon: "circle",
    gainM: 40,
    displayOrder: 0,
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
    ...overrides,
  }
}

function segment(overrides = {}) {
  return {
    id: T03,
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    originElementId: NAP_02,
    destinationElementId: NAP_03,
    name: "T-03",
    type: "tendido",
    cableReference: "ADSS 24 FO",
    color: "#2563eb",
    notes: "Cruza por lateral de avenida",
    geometry: [
      { latitude: -31.42, longitude: -64.18 },
      { latitude: -31.43, longitude: -64.19 },
    ],
    plannedLengthM: 500,
    displayOrder: 0,
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
    ...overrides,
  }
}

function gain(overrides = {}) {
  return {
    id: "gain-t03",
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    segmentId: T03,
    latitude: -31.425,
    longitude: -64.185,
    gainM: 15,
    observations: "",
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
    ...overrides,
  }
}

function fullSnapshot() {
  return {
    elements: [
      element({ id: NAP_02, name: "NAP-02", kind: "nap", gainM: 40 }),
      element({ id: NAP_03, name: "NAP-03", kind: "nap", gainM: 25 }),
      element({ id: NAP_04, name: "NAP-04", kind: "nap", gainM: 10 }),
    ],
    segments: [
      segment({
        id: T01,
        name: "T-01",
        originElementId: NAP_02,
        destinationElementId: NAP_03,
        plannedLengthM: 650,
        notes: "",
        cableReference: "ADSS 24 FO",
      }),
      segment({
        id: T02,
        name: "T-02",
        originElementId: NAP_03,
        destinationElementId: NAP_04,
        plannedLengthM: 450,
        notes: "",
        cableReference: "ADSS 24 FO",
      }),
      segment(),
    ],
    gains: [
      gain({ id: "gain-t01", segmentId: T01, gainM: 10 }),
      gain({ id: "gain-t02", segmentId: T02, gainM: 5 }),
      gain({ id: "gain-t03", segmentId: T03, gainM: 15 }),
    ],
  }
}

test("1. Traza con todos los datos", () => {
  const detail = buildProjectDesignTraceDetail(segment(), fullSnapshot())
  assert.equal(detail.identifier, "T-03")
  assert.equal(detail.typeLabel, "Tendido")
  assert.equal(detail.plannedLengthM, 500)
  assert.equal(detail.plannedLengthLabel, formatPlannedLengthMeters(500))
  assert.equal(detail.cableReferenceLabel, "ADSS 24 FO")
  assert.equal(detail.originLabel, "NAP-02")
  assert.equal(detail.destinationLabel, "NAP-03")
  assert.equal(detail.gainM, 15)
  assert.equal(detail.gainLabel, formatGainMeters(15))
  assert.equal(detail.observationsLabel, "Cruza por lateral de avenida")
})

test("2. Traza sin origen", () => {
  const detail = buildProjectDesignTraceDetail(
    segment({ originElementId: null }),
    fullSnapshot()
  )
  assert.equal(detail.originLabel, PROJECT_DESIGN_UNDEFINED_ENDPOINT)
  assert.equal(detail.destinationLabel, "NAP-03")
  assert.equal(detail.originDestinationLabel, "Sin definir → NAP-03")
})

test("3. Traza sin destino", () => {
  const detail = buildProjectDesignTraceDetail(
    segment({ destinationElementId: null }),
    fullSnapshot()
  )
  assert.equal(detail.destinationLabel, PROJECT_DESIGN_UNDEFINED_ENDPOINT)
  assert.equal(detail.originLabel, "NAP-02")
})

test("4. Traza sin cable_reference", () => {
  const detail = buildProjectDesignTraceDetail(
    segment({ cableReference: "  " }),
    fullSnapshot()
  )
  assert.equal(detail.cableReferenceLabel, PROJECT_DESIGN_UNSPECIFIED_CABLE)
})

test("5. Traza sin ganancia", () => {
  const detail = buildProjectDesignTraceDetail(segment(), {
    ...fullSnapshot(),
    gains: [],
  })
  assert.equal(detail.gainM, 0)
  assert.equal(detail.gainLabel, formatGainMeters(0))
})

test("6. OT con una traza", () => {
  const view = buildTendidoOtTracesView({
    snapshot: fullSnapshot(),
    segmentIds: [T03],
  })
  assert.equal(view.traces.length, 1)
  assert.equal(view.traces[0].id, T03)
  assert.equal(view.plannedLengthM, 500)
  assert.equal(view.traceGainM, 15)
  assert.equal(view.plannedCableM, 515)
})

test("7. OT con múltiples trazas", () => {
  const view = buildTendidoOtTracesView({
    snapshot: fullSnapshot(),
    segmentIds: [T01, T02, T03],
  })
  assert.deepEqual(
    view.traces.map((item) => item.id),
    [T01, T02, T03]
  )
  assert.equal(view.traces[0].originDestinationLabel, "NAP-02 → NAP-03")
})

test("8. Cálculo correcto de metros totales", () => {
  const view = buildTendidoOtTracesView({
    snapshot: fullSnapshot(),
    segmentIds: [T01, T02, T03],
  })
  assert.equal(view.plannedLengthM, 1600)
  assert.equal(view.plannedLengthM, 650 + 450 + 500)
})

test("9. Cálculo correcto de ganancias de trazas", () => {
  const view = buildTendidoOtTracesView({
    snapshot: fullSnapshot(),
    segmentIds: [T01, T02, T03],
  })
  assert.equal(view.traceGainM, 30)
  assert.equal(view.plannedCableM, 1630)
})

test("10. NO se suman ganancias de NAP/Node", () => {
  const snapshot = fullSnapshot()
  const view = buildTendidoOtTracesView({
    snapshot,
    segmentIds: [T01, T02, T03],
  })
  const designSummary = buildProjectDesignSummary(
    snapshot.elements,
    snapshot.segments,
    snapshot.gains
  )
  assert.equal(designSummary.elementGainM, 75)
  assert.equal(view.traceGainM, 30)
  assert.notEqual(view.plannedCableM, view.plannedLengthM + view.traceGainM + 75)
  assert.equal(view.plannedCableM, view.plannedLengthM + view.traceGainM)
})

test("11. segmentIds inexistentes no rompen", () => {
  const view = buildTendidoOtTracesView({
    snapshot: fullSnapshot(),
    segmentIds: [T01, MISSING, T02],
  })
  assert.deepEqual(
    view.traces.map((item) => item.id),
    [T01, T02]
  )
  assert.deepEqual(view.missingSegmentIds, [MISSING])
  assert.equal(view.plannedLengthM, 1100)
  assert.equal(view.traceGainM, 15)
})

test("12. Diseño sin trazas no rompe", () => {
  const view = buildTendidoOtTracesView({
    snapshot: { elements: [], segments: [], gains: [] },
    segmentIds: [T01, T02],
  })
  assert.deepEqual(view.traces, [])
  assert.deepEqual(view.missingSegmentIds, [T01, T02])
  assert.equal(view.plannedLengthM, 0)
  assert.equal(view.traceGainM, 0)
  assert.equal(view.plannedCableM, 0)

  const empty = buildTendidoOtTracesView({
    snapshot: null,
    segmentIds: [],
  })
  assert.deepEqual(empty.traces, [])
  assert.equal(empty.plannedLengthM, 0)
})

test("detalle usa planned_length_m y no recalcula geometría", () => {
  const detail = buildProjectDesignTraceDetail(
    segment({
      plannedLengthM: 500,
      geometry: [
        { latitude: -31.42, longitude: -64.18 },
        { latitude: -31.5, longitude: -64.3 },
      ],
    }),
    fullSnapshot()
  )
  assert.equal(detail.plannedLengthM, 500)
})

test("inspector y mapa consultan trazas sin exigir deselección", () => {
  const inspector = readFileSync(INSPECTOR_PATH, "utf8")
  const canvas = readFileSync(CANVAS_PATH, "utf8")
  const otSection = readFileSync(OT_SECTION_PATH, "utf8")

  assert.match(inspector, /buildProjectDesignTraceDetail/)
  assert.match(inspector, /Cable \/ referencia/)
  assert.match(inspector, /Sin definir/)
  assert.match(canvas, /onSelectSegmentRef\.current\(segment\.id\)/)
  assert.doesNotMatch(canvas, /if \(isSelected\) return/)
  assert.match(otSection, /buildTendidoOtTracesView/)
  assert.match(otSection, /listProjectDesign/)
  assert.doesNotMatch(otSection, /projectDesignPlanSnapshot/)
})
