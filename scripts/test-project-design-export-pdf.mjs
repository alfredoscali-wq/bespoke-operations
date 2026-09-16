import assert from "node:assert/strict"
import test from "node:test"

import { buildProjectDesignSummary } from "../lib/projects/design/summary.ts"
import {
  createDefaultProjectDesignExportOptions,
  DEFAULT_PROJECT_DESIGN_EXPORT_OPTIONS,
} from "../lib/projects/design/export-options.ts"
import {
  buildProjectDesignExportFilename,
  buildProjectDesignExportLegend,
  buildProjectDesignExportModel,
  formatProjectDesignExportTimestamp,
  sanitizeProjectDesignExportFilenamePart,
} from "../lib/projects/design/export-model.ts"
import {
  projectDesignLatLngToCanvas,
  resolveProjectDesignExportMapBounds,
} from "../lib/projects/design/export-map.ts"
import { renderProjectDesignPdf } from "../lib/projects/design/export-pdf.ts"
import {
  DEFAULT_NAP_COLOR,
  DEFAULT_NODE_COLOR,
  DEFAULT_SEGMENT_COLOR,
  projectDesignColorToRgb,
} from "../lib/projects/design/colors.ts"

const COMPANY_A = "00000000-0000-4000-8000-00000000000a"
const PROJECT_A = "11111111-1111-4111-8111-111111111111"

function project(overrides = {}) {
  return {
    id: PROJECT_A,
    code: "OB-2026/01",
    name: "FTTH Centro",
    status: "planned",
    location: "Córdoba",
    description: "Observación de diseño.",
    latitude: -31.42,
    longitude: -64.18,
    ...overrides,
  }
}

function element(overrides = {}) {
  return {
    id: "el-node-1",
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    kind: "node",
    name: "Nodo 1",
    latitude: -31.42,
    longitude: -64.18,
    notes: "Sala",
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
    notes: "",
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
    notes: "Tramo principal",
    geometry: [
      { latitude: -31.42, longitude: -64.18 },
      { latitude: -31.421, longitude: -64.181 },
    ],
    plannedLengthM: 1000,
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

function fullSnapshot() {
  return {
    elements: [element(), nap()],
    segments: [
      segment(),
      segment({
        id: "seg-drop",
        type: "drop",
        originElementId: "el-nap-1",
        destinationElementId: null,
        plannedLengthM: 40,
        geometry: [
          { latitude: -31.421, longitude: -64.181 },
          { latitude: -31.4215, longitude: -64.1815 },
        ],
      }),
    ],
    gains: [gain()],
  }
}

test("el nombre de archivo sanitiza el código y cae a projectId", () => {
  assert.equal(
    buildProjectDesignExportFilename({ code: "OB-2026/01", projectId: PROJECT_A }),
    "diseno-obra-ob-2026-01.pdf"
  )
  assert.equal(
    buildProjectDesignExportFilename({ code: "  ", projectId: PROJECT_A }),
    `diseno-obra-${PROJECT_A}.pdf`
  )
  assert.equal(sanitizeProjectDesignExportFilenamePart("Nodo Ñandú"), "nodo-nandu")
})

test("un diseño vacío exporta cabecera, resumen en cero y sin tablas pobladas", () => {
  const model = buildProjectDesignExportModel({
    project: project({ description: "" }),
    snapshot: { elements: [], segments: [], gains: [] },
    options: DEFAULT_PROJECT_DESIGN_EXPORT_OPTIONS,
    exportedAt: new Date("2026-09-14T18:00:00"),
  })

  assert.equal(model.header.brand, "BESPOKE")
  assert.equal(model.header.code, "OB-2026/01")
  assert.equal(model.header.location, "Córdoba")
  assert.equal(model.summary.nodeCount, 0)
  assert.equal(model.summary.totalCableM, 0)
  assert.equal(model.nodes.length, 0)
  assert.equal(model.naps.length, 0)
  assert.equal(model.traces.length, 0)
  assert.equal(model.gains.length, 0)
  assert.equal(model.notes, null)
  assert.equal(model.includedSections.includes("notes"), false)
  assert.equal(model.includedSections.includes("legend"), false)
  assert.equal(model.includedSections.includes("map"), true)
  assert.equal(model.includedSections.includes("summary"), true)
  assert.equal(model.map.hasRenderableFeatures, false)
  assert.equal(model.map.elements.every((item) => !item.highlighted), true)
})

test("el resumen del exportador reutiliza la lógica de Diseño", () => {
  const snapshot = fullSnapshot()
  const expected = buildProjectDesignSummary(
    snapshot.elements,
    snapshot.segments,
    snapshot.gains
  )
  const model = buildProjectDesignExportModel({
    project: project(),
    snapshot,
    options: DEFAULT_PROJECT_DESIGN_EXPORT_OPTIONS,
  })

  assert.equal(model.summary.nodeCount, expected.nodeCount)
  assert.equal(model.summary.napCount, expected.napCount)
  assert.equal(model.summary.segmentCount, expected.segmentCount)
  assert.equal(model.summary.plannedLengthM, expected.plannedLengthM)
  assert.equal(model.summary.traceGainM, expected.traceGainM)
  assert.equal(model.summary.elementGainM, expected.elementGainM)
  assert.equal(model.summary.totalCableM, expected.totalCableM)
  assert.equal(model.summary.gainCount, 1)
  assert.equal(model.summary.totalCableM, 1063)
  assert.ok(model.summary.rows.some((row) => row.label === "Total de cable planificado"))
})

test("tablas de Node, NAP, trazas y ganancias salen del snapshot", () => {
  const model = buildProjectDesignExportModel({
    project: project(),
    snapshot: fullSnapshot(),
    options: DEFAULT_PROJECT_DESIGN_EXPORT_OPTIONS,
  })

  assert.equal(model.nodes[0].identifier, "Nodo 1")
  assert.equal(model.nodes[0].notes, "Sala")
  assert.equal(model.naps[0].identifier, "NAP 1")
  assert.equal(model.traces[0].type, "Tendido")
  assert.equal(model.traces[1].type, "Drop")
  assert.equal(model.traces[0].origin, "Nodo 1")
  assert.equal(model.traces[0].destination, "NAP 1")
  assert.equal(model.gains[0].identifier, "G1")
  assert.match(model.gains[0].trace, /Nodo 1/)
  assert.equal(model.notes, "Observación de diseño.")
})

test("omite secciones desactivadas y observaciones vacías", () => {
  const options = createDefaultProjectDesignExportOptions()
  options.sections.map = false
  options.sections.nodes = false
  options.sections.notes = true
  const model = buildProjectDesignExportModel({
    project: project({ description: "   " }),
    snapshot: fullSnapshot(),
    options,
  })
  assert.equal(model.includedSections.includes("map"), false)
  assert.equal(model.includedSections.includes("nodes"), false)
  assert.equal(model.includedSections.includes("naps"), true)
  assert.equal(model.includedSections.includes("notes"), false)
})

test("solo Node/NAP o solo trazas no rompe el modelo", () => {
  const nodesOnly = buildProjectDesignExportModel({
    project: project({ description: "" }),
    snapshot: { elements: [element(), nap()], segments: [], gains: [] },
    options: DEFAULT_PROJECT_DESIGN_EXPORT_OPTIONS,
  })
  assert.equal(nodesOnly.nodes.length, 1)
  assert.equal(nodesOnly.naps.length, 1)
  assert.equal(nodesOnly.traces.length, 0)
  assert.equal(nodesOnly.map.elements.length, 2)

  const tracesOnly = buildProjectDesignExportModel({
    project: project({ description: "" }),
    snapshot: { elements: [], segments: [segment()], gains: [gain()] },
    options: DEFAULT_PROJECT_DESIGN_EXPORT_OPTIONS,
  })
  assert.equal(tracesOnly.traces.length, 1)
  assert.equal(tracesOnly.gains.length, 1)
  assert.equal(tracesOnly.map.segments.length, 1)
})

test("geometría inválida no entra al mapa y coordenadas inválidas se muestran como guión", () => {
  const model = buildProjectDesignExportModel({
    project: project(),
    snapshot: {
      elements: [element({ latitude: 200, longitude: 0 })],
      segments: [segment({ id: "bad", geometry: [] }), segment()],
      gains: [gain({ latitude: 95, longitude: 0 })],
    },
    options: DEFAULT_PROJECT_DESIGN_EXPORT_OPTIONS,
  })
  assert.equal(model.nodes[0].latitude, "—")
  assert.equal(model.gains[0].latitude, "—")
  assert.equal(model.traces.length, 2)
  assert.equal(model.map.segments.some((item) => item.id === "bad"), false)
  assert.equal(model.map.segments.some((item) => item.id === "seg-1"), true)
})

test("el highlight no aplica a la exportación", () => {
  const model = buildProjectDesignExportModel({
    project: project(),
    snapshot: fullSnapshot(),
    options: DEFAULT_PROJECT_DESIGN_EXPORT_OPTIONS,
  })
  assert.equal(model.map.elements.every((item) => item.highlighted === false), true)
  assert.equal(model.map.segments.every((item) => item.highlighted === false), true)
  assert.equal(model.map.gains.every((item) => item.highlighted === false), true)
})

test("la leyenda usa colores del diseño actual", () => {
  const legend = buildProjectDesignExportLegend(fullSnapshot())
  assert.ok(legend.some((item) => item.kind === "node" && item.color === DEFAULT_NODE_COLOR))
  assert.ok(legend.some((item) => item.kind === "nap" && item.color === DEFAULT_NAP_COLOR))
  assert.ok(legend.some((item) => item.kind === "trace" && item.typeLabel === "Tendido"))
  assert.ok(legend.some((item) => item.kind === "trace" && item.typeLabel === "Drop"))
  assert.ok(legend.some((item) => item.kind === "gain"))
})

test("muchas trazas se listan todas en el modelo", () => {
  const segments = Array.from({ length: 40 }, (_, index) =>
    segment({
      id: `seg-${index}`,
      plannedLengthM: 10,
      type: index % 3 === 0 ? "drop" : index % 3 === 1 ? "otro" : "tendido",
    })
  )
  const model = buildProjectDesignExportModel({
    project: project(),
    snapshot: { elements: [], segments, gains: [] },
    options: DEFAULT_PROJECT_DESIGN_EXPORT_OPTIONS,
  })
  assert.equal(model.traces.length, 40)
  assert.equal(model.summary.segmentCount, 40)
  assert.ok(model.traces.some((row) => row.type === "Otro"))
})

test("localidad vacía se omite; timestamp y CRS quedan fijos", () => {
  const exportedAt = new Date(2026, 8, 14, 15, 45, 0)
  const model = buildProjectDesignExportModel({
    project: project({ location: "  " }),
    snapshot: { elements: [], segments: [], gains: [] },
    options: DEFAULT_PROJECT_DESIGN_EXPORT_OPTIONS,
    exportedAt,
  })
  assert.equal(model.header.location, null)
  assert.equal(
    model.summary.rows.some((row) => row.label === "Localidad"),
    false
  )
  assert.equal(model.header.crs, "WGS84 / EPSG:4326")
  assert.equal(model.header.exportedAt, formatProjectDesignExportTimestamp(exportedAt))
})

test("el mapa estático proyecta puntos dentro del canvas", () => {
  const bounds = resolveProjectDesignExportMapBounds([
    { latitude: -31.42, longitude: -64.18 },
    { latitude: -31.43, longitude: -64.19 },
  ])
  assert.ok(bounds)
  const point = projectDesignLatLngToCanvas(
    { latitude: -31.425, longitude: -64.185 },
    { bounds, width: 800, height: 600, padding: 20 }
  )
  assert.ok(point.x > 20 && point.x < 780)
  assert.ok(point.y > 20 && point.y < 580)
  assert.equal(resolveProjectDesignExportMapBounds([]), null)
})

test("hex del diseño se convierte a RGB para el PDF", () => {
  assert.deepEqual(projectDesignColorToRgb(DEFAULT_NAP_COLOR), {
    r: 37,
    g: 99,
    b: 235,
  })
})

test("renderProjectDesignPdf genera un blob PDF también con diseño vacío", async () => {
  const empty = buildProjectDesignExportModel({
    project: project({ description: "" }),
    snapshot: { elements: [], segments: [], gains: [] },
    options: DEFAULT_PROJECT_DESIGN_EXPORT_OPTIONS,
  })
  const emptyBlob = await renderProjectDesignPdf(empty, {
    logoDataUrl: null,
    mapDataUrl: null,
  })
  assert.ok(emptyBlob.size > 200)

  const full = buildProjectDesignExportModel({
    project: project(),
    snapshot: fullSnapshot(),
    options: DEFAULT_PROJECT_DESIGN_EXPORT_OPTIONS,
  })
  const fullBlob = await renderProjectDesignPdf(full, {
    logoDataUrl: null,
    mapDataUrl: null,
  })
  assert.ok(fullBlob.size > emptyBlob.size)
})
