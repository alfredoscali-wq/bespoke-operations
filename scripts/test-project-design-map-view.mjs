import assert from "node:assert/strict"
import test from "node:test"

import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  SELECTED_LOCATION_MAP_ZOOM,
} from "../lib/gps/constants.ts"
import { projectDesignGainMarkerHtml } from "../lib/projects/design/gains.ts"
import {
  buildProjectDesignMapViewModel,
  collectProjectDesignMapViewPoints,
  isProjectDesignElementHighlighted,
  isProjectDesignSegmentHighlighted,
  normalizeProjectDesignMapHighlight,
  parseProjectDesignMapHighlightKey,
  PROJECT_DESIGN_MAP_VIEW_POLYLINE,
  resolveProjectDesignMapViewFrame,
} from "../lib/projects/design/map-view.ts"
import {
  DEFAULT_NAP_COLOR,
  DEFAULT_NODE_COLOR,
  DEFAULT_SEGMENT_COLOR,
} from "../lib/projects/design/colors.ts"

const COMPANY_A = "00000000-0000-4000-8000-00000000000a"
const PROJECT_A = "11111111-1111-4111-8111-111111111111"

function element(overrides = {}) {
  return {
    id: "el-node-1",
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    kind: "node",
    name: "Nodo 1",
    latitude: -31.42,
    longitude: -64.18,
    notes: "",
    color: DEFAULT_NODE_COLOR,
    icon: "square",
    gainM: 5,
    displayOrder: 0,
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
    ...overrides,
  }
}

function nap(overrides = {}) {
  return element({
    id: "el-nap-1",
    kind: "nap",
    name: "NAP 1",
    latitude: -31.421,
    longitude: -64.181,
    color: DEFAULT_NAP_COLOR,
    icon: "circle",
    gainM: 8,
    ...overrides,
  })
}

function segment(overrides = {}) {
  return {
    id: "seg-1",
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    originElementId: "el-node-1",
    destinationElementId: "el-nap-1",
    name: "",
    type: "tendido",
    cableReference: "",
    color: DEFAULT_SEGMENT_COLOR,
    notes: "",
    geometry: [
      { latitude: -31.42, longitude: -64.18 },
      { latitude: -31.421, longitude: -64.181 },
    ],
    plannedLengthM: 142.5,
    displayOrder: 0,
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
    ...overrides,
  }
}

function gain(overrides = {}) {
  return {
    id: "gain-1",
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    segmentId: "seg-1",
    latitude: -31.4205,
    longitude: -64.1805,
    gainM: 10,
    observations: "",
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-13T00:00:00.000Z",
    ...overrides,
  }
}

function validSnapshot() {
  return {
    elements: [element(), nap()],
    segments: [
      segment(),
      segment({
        id: "seg-2",
        originElementId: "el-nap-1",
        destinationElementId: null,
        geometry: [
          { latitude: -31.421, longitude: -64.181 },
          { latitude: -31.422, longitude: -64.182 },
        ],
        plannedLengthM: 80,
      }),
    ],
    gains: [gain()],
  }
}

test("un snapshot vacío es renderizable y usa el centro por defecto", () => {
  const model = buildProjectDesignMapViewModel({
    snapshot: { elements: [], segments: [], gains: [] },
  })

  assert.equal(model.elements.length, 0)
  assert.equal(model.segments.length, 0)
  assert.equal(model.gains.length, 0)
  assert.equal(model.hasRenderableFeatures, false)
  assert.equal(model.boundsPoints.length, 0)
  assert.equal(model.frame.hasProjectGps, false)
  assert.equal(model.frame.center.latitude, DEFAULT_MAP_CENTER.latitude)
  assert.equal(model.frame.center.longitude, DEFAULT_MAP_CENTER.longitude)
  assert.equal(model.frame.zoom, DEFAULT_MAP_ZOOM)
  assert.deepEqual(model.highlight, { elementIds: [], segmentIds: [] })
})

test("un snapshot nulo se trata como diseño vacío", () => {
  const model = buildProjectDesignMapViewModel({ snapshot: null })
  assert.equal(model.hasRenderableFeatures, false)
  assert.equal(model.elements.length, 0)
})

test("el snapshot válido incluye Node, NAP, trazas y ganancias", () => {
  const model = buildProjectDesignMapViewModel({ snapshot: validSnapshot() })

  assert.equal(model.elements.length, 2)
  assert.ok(model.elements.some((item) => item.kind === "node" && item.name === "Nodo 1"))
  assert.ok(model.elements.some((item) => item.kind === "nap" && item.name === "NAP 1"))
  assert.equal(model.segments.length, 2)
  assert.equal(model.gains.length, 1)
  assert.equal(model.gains[0].gainM, 10)
  assert.equal(model.gains[0].labeled, true)
  assert.equal(model.hasRenderableFeatures, true)
  assert.ok(model.boundsPoints.length >= 4)
})

test("conserva color e icono de Node y NAP", () => {
  const model = buildProjectDesignMapViewModel({
    snapshot: {
      elements: [
        element({ color: "#16a34a", icon: "diamond" }),
        nap({ color: "#7c3aed", icon: "hexagon" }),
      ],
      segments: [],
      gains: [],
    },
  })

  const node = model.elements.find((item) => item.kind === "node")
  const napItem = model.elements.find((item) => item.kind === "nap")
  assert.equal(node?.color, "#16a34a")
  assert.equal(node?.icon, "diamond")
  assert.equal(napItem?.color, "#7c3aed")
  assert.equal(napItem?.icon, "hexagon")
})

test("omite geometría vacía o inválida y conserva trazas válidas", () => {
  const model = buildProjectDesignMapViewModel({
    snapshot: {
      elements: [element()],
      segments: [
        segment({ id: "empty", geometry: [] }),
        segment({
          id: "one-point",
          geometry: [{ latitude: -31.42, longitude: -64.18 }],
        }),
        segment({
          id: "invalid",
          geometry: [
            { latitude: 999, longitude: 0 },
            { latitude: -31.42, longitude: -64.18 },
          ],
        }),
        segment({ id: "ok" }),
      ],
      gains: [],
    },
  })

  assert.deepEqual(
    model.segments.map((item) => item.id),
    ["ok"]
  )
  assert.equal(model.segments[0].geometry.length, 2)
})

test("omite Node/NAP y ganancias sin coordenadas válidas", () => {
  const model = buildProjectDesignMapViewModel({
    snapshot: {
      elements: [
        element(),
        nap({ latitude: 200, longitude: 0 }),
        element({ id: "el-bad", latitude: Number.NaN, longitude: -64.18 }),
      ],
      segments: [],
      gains: [
        gain(),
        gain({ id: "gain-bad", latitude: 91, longitude: 0 }),
      ],
    },
  })

  assert.deepEqual(
    model.elements.map((item) => item.id),
    ["el-node-1"]
  )
  assert.deepEqual(
    model.gains.map((item) => item.id),
    ["gain-1"]
  )
})

test("sin highlight ningún feature queda destacado", () => {
  const snapshot = validSnapshot()
  const model = buildProjectDesignMapViewModel({ snapshot, highlight: null })

  assert.equal(model.elements.every((item) => item.highlighted === false), true)
  assert.equal(model.segments.every((item) => item.highlighted === false), true)
  assert.equal(model.gains.every((item) => item.highlighted === false), true)
  assert.equal(
    model.segments.every(
      (item) =>
        item.weight === PROJECT_DESIGN_MAP_VIEW_POLYLINE.context.weight &&
        item.opacity === PROJECT_DESIGN_MAP_VIEW_POLYLINE.context.opacity
    ),
    true
  )
  assert.equal(isProjectDesignElementHighlighted("el-node-1", null), false)
  assert.equal(isProjectDesignSegmentHighlighted("seg-1", undefined), false)
})

test("highlight de element destaca el Node o NAP y deja el resto como contexto", () => {
  const snapshot = validSnapshot()
  const model = buildProjectDesignMapViewModel({
    snapshot,
    highlight: { kind: "element", id: "el-nap-1" },
  })

  const napItem = model.elements.find((item) => item.id === "el-nap-1")
  const node = model.elements.find((item) => item.id === "el-node-1")
  assert.equal(napItem?.highlighted, true)
  assert.equal(node?.highlighted, false)
  assert.equal(model.segments.every((item) => item.highlighted === false), true)
  assert.equal(isProjectDesignElementHighlighted("el-nap-1", { kind: "element", id: "el-nap-1" }), true)
  assert.equal(isProjectDesignElementHighlighted("el-node-1", { kind: "element", id: "el-nap-1" }), false)
})

test("highlight de segment destaca esa traza y deja las demás visibles como contexto", () => {
  const snapshot = validSnapshot()
  const model = buildProjectDesignMapViewModel({
    snapshot,
    highlight: { kind: "segment", id: "seg-2" },
  })

  const highlighted = model.segments.find((item) => item.id === "seg-2")
  const context = model.segments.find((item) => item.id === "seg-1")
  assert.equal(highlighted?.highlighted, true)
  assert.equal(highlighted?.weight, PROJECT_DESIGN_MAP_VIEW_POLYLINE.highlight.weight)
  assert.equal(context?.highlighted, false)
  assert.equal(context?.weight, PROJECT_DESIGN_MAP_VIEW_POLYLINE.context.weight)
  assert.equal(model.segments.length, 2)
  assert.equal(model.segments[model.segments.length - 1].id, "seg-2")
  assert.equal(model.gains[0].highlighted, false)
})

test("ids de segmentos permite destacar varias trazas sin asociar OTs", () => {
  const snapshot = validSnapshot()
  const model = buildProjectDesignMapViewModel({
    snapshot,
    highlight: { kind: "segment", ids: ["seg-1", "seg-2"] },
  })

  assert.equal(model.segments.every((item) => item.highlighted), true)
  assert.deepEqual(model.highlight.segmentIds, ["seg-1", "seg-2"])
  assert.equal(model.gains[0].highlighted, true)
})

test("id + ids de segmento se unen y deduplican", () => {
  const ids = normalizeProjectDesignMapHighlight({
    kind: "segment",
    id: "seg-1",
    ids: ["seg-1", "seg-2", "  "],
  })
  assert.deepEqual(ids, { elementIds: [], segmentIds: ["seg-1", "seg-2"] })
})

test("un highlight inexistente no rompe el snapshot", () => {
  const model = buildProjectDesignMapViewModel({
    snapshot: validSnapshot(),
    highlight: { kind: "element", id: "missing" },
  })
  assert.equal(model.elements.length, 2)
  assert.equal(model.elements.every((item) => item.highlighted === false), true)
})

test("parsea la clave de highlight usada por el preview", () => {
  assert.deepEqual(parseProjectDesignMapHighlightKey(""), null)
  assert.deepEqual(parseProjectDesignMapHighlightKey("element:el-nap-1"), {
    kind: "element",
    id: "el-nap-1",
  })
  assert.deepEqual(parseProjectDesignMapHighlightKey("segment:seg-1"), {
    kind: "segment",
    id: "seg-1",
  })
  assert.equal(parseProjectDesignMapHighlightKey("gain:x"), null)
})

test("el GPS de la Obra define el frame inicial; si falta, se usa Córdoba", () => {
  const withGps = resolveProjectDesignMapViewFrame({
    projectLatitude: -31.4,
    projectLongitude: -64.2,
  })
  assert.equal(withGps.hasProjectGps, true)
  assert.equal(withGps.center.latitude, -31.4)
  assert.equal(withGps.zoom, SELECTED_LOCATION_MAP_ZOOM)

  const withoutGps = resolveProjectDesignMapViewFrame({
    projectLatitude: null,
    projectLongitude: null,
  })
  assert.equal(withoutGps.hasProjectGps, false)
  assert.equal(withoutGps.center.latitude, DEFAULT_MAP_CENTER.latitude)
  assert.equal(withoutGps.zoom, DEFAULT_MAP_ZOOM)
})

test("collectProjectDesignMapViewPoints ignora geometría vacía", () => {
  const points = collectProjectDesignMapViewPoints({
    elements: [element()],
    segments: [segment({ geometry: [] })],
    gains: [],
  })
  assert.equal(points.length, 1)
  assert.equal(points[0].latitude, -31.42)
})

test("el tooltip de Node/NAP y traza es informativo", () => {
  const model = buildProjectDesignMapViewModel({ snapshot: validSnapshot() })
  const node = model.elements.find((item) => item.kind === "node")
  const napItem = model.elements.find((item) => item.kind === "nap")
  const firstSegment = model.segments.find((item) => item.id === "seg-1")
  assert.match(node?.tooltip ?? "", /Nodo/)
  assert.match(napItem?.tooltip ?? "", /NAP/)
  assert.match(firstSegment?.tooltip ?? "", /Nodo 1/)
  assert.match(model.gains[0].tooltip, /10/)
})

test("la ganancia del visor puede mostrar gainM aunque no esté seleccionada", () => {
  const labeled = projectDesignGainMarkerHtml({
    gainM: 12.5,
    color: DEFAULT_SEGMENT_COLOR,
    labeled: true,
  })
  const unlabeled = projectDesignGainMarkerHtml({
    gainM: 12.5,
    color: DEFAULT_SEGMENT_COLOR,
  })
  assert.match(labeled, /12,5 m/)
  assert.equal(unlabeled.includes("12,5 m"), false)
})
