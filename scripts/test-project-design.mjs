import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import {
  formatGainMeters,
  calculateGpsDistanceMeters,
  calculatePolylineLengthMeters,
  formatPlannedLengthMeters,
  roundPlannedLengthMeters,
} from "../lib/gps/distance.ts"
import {
  assertSameProjectDesignTenant,
  buildProjectDesignElementDeleteMessage,
  buildProjectDesignSegmentDeleteMessage,
  resolveProjectDesignElementDeleteImpact,
} from "../lib/projects/design/deletion.ts"
import { parseDesignGeometry, validateDesignGeometry } from "../lib/projects/design/geometry.ts"
import {
  DEFAULT_TRACE_GAIN_M,
  filterGainsAfterSegmentDelete,
  parseProjectDesignGainMeters,
  resolveGainPlacement,
} from "../lib/projects/design/gains.ts"
import { suggestProjectDesignElementName } from "../lib/projects/design/labels.ts"
import { associateSegmentEndpoints, findSnapTarget } from "../lib/projects/design/snap.ts"
import {
  buildProjectDesignSummary,
  formatProjectDesignSegmentListLabel,
} from "../lib/projects/design/summary.ts"
import {
  prepareProjectDesignElementDraft,
  prepareProjectDesignGainDraft,
  prepareProjectDesignSegmentDraft,
} from "../lib/projects/design/validate.ts"
import {
  DEFAULT_NAP_COLOR,
  DEFAULT_SEGMENT_COLOR,
  normalizeProjectDesignColor,
} from "../lib/projects/design/colors.ts"
import { resolveDesignInspectorAfterSave } from "../lib/projects/design/inspector.ts"
import {
  DEFAULT_NAP_ICON,
  DEFAULT_NODE_ICON,
  projectDesignElementMarkerHtml,
  projectDesignElementShapeSvg,
  resolveElementIcon,
} from "../lib/projects/design/icons.ts"
import {
  persistProjectDesignRecentColor,
  rememberProjectDesignRecentColor,
  readProjectDesignRecentColors,
  writeProjectDesignRecentColors,
} from "../lib/projects/design/recent-colors.ts"
import {
  cancelDesignDrawing,
  resolveDrawingElementClick,
  resolveDrawingFinish,
  resolveDrawingMapClick,
  shouldSelectDesignElement,
  shouldSelectDesignGain,
  shouldSelectDesignSegment,
} from "../lib/projects/design/drawing.ts"
import {
  mapCreateElementToInsert,
  mapCreateGainToInsert,
  mapCreateSegmentToInsert,
  mapProjectDesignElementRow,
  mapProjectDesignGainRow,
  mapProjectDesignSegmentRow,
  mapUpdateElementToUpdate,
  mapUpdateGainToUpdate,
  mapUpdateSegmentToUpdate,
} from "../lib/supabase/project-design.mapper.ts"
import { canAccessPathWithModules, createEmptyModuleVisibility } from "../lib/roles/app-modules.ts"
import {
  PROJECT_DESIGN_ELEMENT_ICONS,
  PROJECT_DESIGN_SEGMENT_TYPES,
} from "../lib/types/project-design.ts"

const COMPANY_A = "00000000-0000-4000-8000-00000000000a"
const COMPANY_B = "00000000-0000-4000-8000-00000000000b"
const PROJECT_A = "11111111-1111-4111-8111-111111111111"

function elementRow(overrides = {}) {
  return {
    id: "el-1",
    company_id: COMPANY_A,
    project_id: PROJECT_A,
    kind: "nap",
    name: "NAP 1",
    latitude: -31.42,
    longitude: -64.18,
    notes: "",
    color: "#2563eb",
    icon: "circle",
    display_order: 0,
    created_at: "2026-09-13T00:00:00.000Z",
    updated_at: "2026-09-13T00:00:00.000Z",
    ...overrides,
  }
}

test("la ruta de diseño queda bajo el módulo Obras", () => {
  assert.equal(
    canAccessPathWithModules("/obras/abc/diseno", createEmptyModuleVisibility()),
    false
  )
  assert.equal(
    canAccessPathWithModules("/obras/abc/diseno", {
      ...createEmptyModuleVisibility(),
      projects: true,
    }),
    true
  )
})

test("Diseño aísla por company_id y no usa PostGIS ni network_sites", () => {
  const queries = readFileSync(
    join(process.cwd(), "lib/supabase/project-design.queries.ts"),
    "utf8"
  )
  assert.match(queries, /from\("project_design_elements"\)/)
  assert.match(queries, /from\("project_design_segments"\)/)
  assert.match(queries, /\.eq\("company_id", companyId\)/)
  assert.match(queries, /\.eq\("project_id", projectId\)/)
  assert.doesNotMatch(queries, /network_sites/)
  assert.doesNotMatch(queries, /network_devices/)
  assert.doesNotMatch(queries, /from\("tasks"\)/)
  assert.doesNotMatch(queries, /CREATE EXTENSION/i)
  assert.doesNotMatch(queries, /st_distance|postgis|gps_haversine_meters/i)

  const insert = mapCreateSegmentToInsert({
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    geometry: [
      { latitude: -31.42, longitude: -64.18 },
      { latitude: -31.43, longitude: -64.19 },
    ],
  })
  assert.equal(insert.company_id, COMPANY_A)
  assert.equal(insert.project_id, PROJECT_A)
  assert.equal(insert.origin_element_id, null)
  assert.equal(insert.destination_element_id, null)
  assert.equal(insert.planned_length_m, 0)

  const cleared = mapUpdateSegmentToUpdate({
    originElementId: null,
    destinationElementId: null,
  })
  assert.equal(cleared.origin_element_id, null)
  assert.equal(cleared.destination_element_id, null)

  const meters = calculateGpsDistanceMeters(-31.42, -64.18, -31.43, -64.19)
  assert.equal(Number.isFinite(meters) && meters > 0, true)
})

test("crea identificadores sugeridos de Nodo y NAP", () => {
  assert.equal(suggestProjectDesignElementName([], "node"), "Nodo 1")
  assert.equal(suggestProjectDesignElementName([], "nap"), "NAP 1")
  assert.equal(
    suggestProjectDesignElementName(
      [
        { kind: "nap", name: "NAP 1" },
        { kind: "nap", name: "NAP 3" },
        { kind: "node", name: "Nodo 1" },
      ],
      "nap"
    ),
    "NAP 4"
  )
})

test("valida creación de nodo/NAP y rechaza otra empresa", () => {
  const ok = prepareProjectDesignElementDraft({
    companyId: COMPANY_A,
    projectCompanyId: COMPANY_A,
    projectId: PROJECT_A,
    kind: "node",
    name: "Nodo principal",
    latitude: -31.42,
    longitude: -64.18,
  })
  assert.equal(ok.ok, true)

  const otherCompany = prepareProjectDesignElementDraft({
    companyId: COMPANY_B,
    projectCompanyId: COMPANY_A,
    projectId: PROJECT_A,
    kind: "nap",
    name: "NAP 1",
    latitude: -31.42,
    longitude: -64.18,
  })
  assert.equal(otherCompany.ok, false)

  const mapped = mapCreateElementToInsert({
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    kind: "nap",
    name: "  NAP 1  ",
    latitude: -31.42,
    longitude: -64.18,
  })
  assert.equal(mapped.name, "NAP 1")
  assert.equal(mapped.kind, "nap")
  assert.equal(mapped.color, DEFAULT_NAP_COLOR)
})

test("editar/mover actualiza coordenadas en el mapper", () => {
  const update = mapUpdateElementToUpdate({
    latitude: -31.4300001,
    longitude: -64.1900001,
  })
  assert.equal(update.latitude, -31.4300001)
  assert.equal(update.longitude, -64.1900001)

  const row = mapProjectDesignElementRow(
    elementRow({ latitude: "-31.4300001", longitude: "-64.1900001" })
  )
  assert.equal(row.latitude, -31.4300001)
  assert.equal(row.longitude, -64.1900001)
})

test("crea un tramo con geometría exacta de los puntos dibujados", () => {
  const geometry = [
    { latitude: -31.42, longitude: -64.18 },
    { latitude: -31.421, longitude: -64.181 },
    { latitude: -31.422, longitude: -64.182 },
  ]
  const prepared = prepareProjectDesignSegmentDraft({
    companyId: COMPANY_A,
    projectCompanyId: COMPANY_A,
    projectId: PROJECT_A,
    geometry,
  })
  assert.equal(prepared.ok, true)
  if (!prepared.ok) return
  assert.equal(prepared.payload.geometry.length, 3)
  assert.equal(prepared.payload.geometry[1].latitude, -31.421)
  const insert = mapCreateSegmentToInsert(prepared.payload)
  assert.equal(insert.project_id, PROJECT_A)
  assert.equal(insert.company_id, COMPANY_A)
})

test("calcula distancia geográfica en metros, no en píxeles", () => {
  const oneDegreeAtEquator = calculateGpsDistanceMeters(0, 0, 0, 1)
  assert.equal(Math.round(oneDegreeAtEquator), 111195)

  const polyline = calculatePolylineLengthMeters([
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 0.5 },
    { latitude: 0, longitude: 1 },
  ])
  assert.equal(Math.round(polyline), 111195)
  assert.equal(formatPlannedLengthMeters(427.4), "427 m")
})

test("recalcula la longitud al modificar la geometría", () => {
  const short = prepareProjectDesignSegmentDraft({
    companyId: COMPANY_A,
    projectCompanyId: COMPANY_A,
    projectId: PROJECT_A,
    geometry: [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 0.5 },
    ],
  })
  const longer = prepareProjectDesignSegmentDraft({
    companyId: COMPANY_A,
    projectCompanyId: COMPANY_A,
    projectId: PROJECT_A,
    geometry: [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
    ],
  })
  assert.equal(short.ok, true)
  assert.equal(longer.ok, true)
  if (!short.ok || !longer.ok) return
  assert.ok(longer.plannedLengthM > short.plannedLengthM)
  assert.equal(
    roundPlannedLengthMeters(longer.plannedLengthM),
    roundPlannedLengthMeters(calculateGpsDistanceMeters(0, 0, 0, 1))
  )
})

test("asocia origen y destino cuando el tramo nace cerca de elementos", () => {
  const node = {
    id: "node-1",
    latitude: -31.42,
    longitude: -64.18,
  }
  const nap = {
    id: "nap-1",
    latitude: -31.421,
    longitude: -64.181,
  }
  const associated = associateSegmentEndpoints({
    geometry: [
      { latitude: -31.42, longitude: -64.18 },
      { latitude: -31.4205, longitude: -64.1805 },
      { latitude: -31.421, longitude: -64.181 },
    ],
    elements: [node, nap],
  })
  assert.equal(associated.originElementId, "node-1")
  assert.equal(associated.destinationElementId, "nap-1")

  const independent = associateSegmentEndpoints({
    geometry: [
      { latitude: -32.9, longitude: -68.8 },
      { latitude: -32.91, longitude: -68.81 },
    ],
    elements: [node, nap],
  })
  assert.equal(independent.originElementId, null)
  assert.equal(independent.destinationElementId, null)
})

test("eliminar un elemento no borra tramos; deja origen/destino nulos", () => {
  const impact = resolveProjectDesignElementDeleteImpact("nap-1", [
    {
      id: "seg-1",
      originElementId: "node-1",
      destinationElementId: "nap-1",
    },
    {
      id: "seg-2",
      originElementId: "nap-2",
      destinationElementId: "nap-3",
    },
  ])
  assert.equal(impact.attachedSegmentCount, 1)
  assert.deepEqual(impact.attachedSegmentIds, ["seg-1"])
  assert.match(
    buildProjectDesignElementDeleteMessage({ name: "NAP 1" }, impact),
    /se conservará/
  )
})

test("el diseño solo acepta la obra del tenant autenticado", () => {
  const ok = assertSameProjectDesignTenant({
    companyId: COMPANY_A,
    projectCompanyId: COMPANY_A,
    projectId: PROJECT_A,
    resourceProjectId: PROJECT_A,
  })
  assert.equal(ok.ok, true)

  const otherCompany = assertSameProjectDesignTenant({
    companyId: COMPANY_A,
    projectCompanyId: COMPANY_B,
    projectId: PROJECT_A,
    resourceProjectId: PROJECT_A,
  })
  assert.equal(otherCompany.ok, false)

  const otherProject = assertSameProjectDesignTenant({
    companyId: COMPANY_A,
    projectCompanyId: COMPANY_A,
    projectId: PROJECT_A,
    resourceProjectId: "22222222-2222-4222-8222-222222222222",
  })
  assert.equal(otherProject.ok, false)

  const queries = readFileSync(
    join(process.cwd(), "lib/supabase/project-design.queries.ts"),
    "utf8"
  )
  assert.match(queries, /\.eq\("company_id", companyId\)/)
  assert.match(queries, /\.eq\("project_id", projectId\)/)
})

test("el resumen sale de los datos guardados", () => {
  const summary = buildProjectDesignSummary(
    [
      { kind: "node" },
      { kind: "nap" },
      { kind: "nap" },
      { kind: "nap" },
    ],
    [{ plannedLengthM: 427 }, { plannedLengthM: 183 }, { plannedLengthM: 291 }]
  )
  assert.equal(summary.nodeCount, 1)
  assert.equal(summary.napCount, 3)
  assert.equal(summary.segmentCount, 3)
  assert.equal(summary.plannedLengthM, 901)
  assert.equal(summary.traceGainM, 0)
  assert.equal(summary.elementGainM, 0)
  assert.equal(summary.totalCableM, 901)
  assert.equal(
    formatProjectDesignSegmentListLabel(
      {
        name: "",
        originElementId: "n1",
        destinationElementId: "nap1",
        plannedLengthM: 427,
      },
      [
        { id: "n1", name: "Nodo principal" },
        { id: "nap1", name: "NAP 1" },
      ]
    ),
    "Nodo principal → NAP 1 — 427 m"
  )
})

test("parsea geometría jsonb y rechaza tramos inválidos", () => {
  const parsed = parseDesignGeometry([
    { latitude: "-31.42", longitude: "-64.18" },
    { latitude: -31.43, longitude: -64.19 },
  ])
  assert.ok(parsed)
  assert.equal(parsed?.[0].latitude, -31.42)

  const invalid = validateDesignGeometry([{ latitude: 0, longitude: 0 }])
  assert.equal(invalid.ok, false)

  const row = mapProjectDesignSegmentRow({
    id: "seg-1",
    company_id: COMPANY_A,
    project_id: PROJECT_A,
    origin_element_id: null,
    destination_element_id: null,
    name: "",
    notes: "",
    type: "tendido",
    cable_reference: "",
    color: "#ea580c",
    geometry: [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 1 },
    ],
    planned_length_m: 111194.93,
    display_order: 0,
    created_at: "2026-09-13T00:00:00.000Z",
    updated_at: "2026-09-13T00:00:00.000Z",
  })
  assert.equal(row.geometry.length, 2)
  assert.equal(row.originElementId, null)
})

test("guarda y persiste el color de un NAP", () => {
  const created = mapCreateElementToInsert({
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    kind: "nap",
    name: "NAP 1",
    latitude: -31.42,
    longitude: -64.18,
    color: "#16a34a",
  })
  assert.equal(created.color, "#16a34a")

  const row = mapProjectDesignElementRow(
    elementRow({ color: "#DC2626" })
  )
  assert.equal(row.color, "#dc2626")
  assert.equal(
    mapUpdateElementToUpdate({ color: "#7c3aed" }).color,
    "#7c3aed"
  )
  assert.equal(normalizeProjectDesignColor("nope", DEFAULT_NAP_COLOR), DEFAULT_NAP_COLOR)

  const invalid = prepareProjectDesignElementDraft({
    companyId: COMPANY_A,
    projectCompanyId: COMPANY_A,
    projectId: PROJECT_A,
    kind: "nap",
    name: "NAP 1",
    latitude: -31.42,
    longitude: -64.18,
    color: "red",
  })
  assert.equal(invalid.ok, false)
})

test("edita tipo, referencia y color del tramo y los persiste", () => {
  const prepared = prepareProjectDesignSegmentDraft({
    companyId: COMPANY_A,
    projectCompanyId: COMPANY_A,
    projectId: PROJECT_A,
    geometry: [
      { latitude: -31.42, longitude: -64.18 },
      { latitude: -31.421, longitude: -64.181 },
    ],
    name: "Tendido principal",
    type: "tendido",
    cableReference: "12 pelos",
    color: "#16a34a",
  })
  assert.equal(prepared.ok, true)
  if (!prepared.ok) return
  assert.equal(prepared.payload.name, "Tendido principal")
  assert.equal(prepared.payload.type, "tendido")
  assert.equal(prepared.payload.cableReference, "12 pelos")
  assert.equal(prepared.payload.color, "#16a34a")

  const insert = mapCreateSegmentToInsert(prepared.payload)
  assert.equal(insert.type, "tendido")
  assert.equal(insert.cable_reference, "12 pelos")
  assert.equal(insert.color, "#16a34a")

  const update = mapUpdateSegmentToUpdate({
    name: "Drop acceso",
    type: "drop",
    cableReference: "Drop",
    color: "#2563eb",
  })
  assert.equal(update.name, "Drop acceso")
  assert.equal(update.type, "drop")
  assert.equal(update.cable_reference, "Drop")
  assert.equal(update.color, "#2563eb")

  const row = mapProjectDesignSegmentRow({
    id: "seg-2",
    company_id: COMPANY_A,
    project_id: PROJECT_A,
    origin_element_id: "n1",
    destination_element_id: "nap1",
    name: "Tendido secundario",
    notes: "",
    type: "drop",
    cable_reference: "24 pelos",
    color: "#0891B2",
    geometry: [
      { latitude: 0, longitude: 0 },
      { latitude: 0, longitude: 0.5 },
    ],
    planned_length_m: 55500,
    display_order: 0,
    created_at: "2026-09-13T00:00:00.000Z",
    updated_at: "2026-09-13T00:00:00.000Z",
  })
  assert.equal(row.type, "drop")
  assert.equal(row.cableReference, "24 pelos")
  assert.equal(row.color, "#0891b2")
  assert.equal(row.name, "Tendido secundario")
  assert.equal(DEFAULT_SEGMENT_COLOR, "#ea580c")
})

test("terminar el tramo sobre NAP/Nodo ajusta geometría y destination_element_id", () => {
  const node = { id: "node-1", latitude: -31.42, longitude: -64.18 }
  const nap = { id: "nap-1", latitude: -31.421, longitude: -64.181 }
  const start = resolveDrawingElementClick({
    element: node,
    drawingPoints: [],
    originElementId: null,
    elements: [node, nap],
  })
  assert.equal(start.action, "add-vertex")
  if (start.action !== "add-vertex") return
  assert.equal(start.originElementId, "node-1")
  assert.equal(start.drawingPoints[0].latitude, node.latitude)

  const mid = resolveDrawingMapClick({
    click: { latitude: -31.4205, longitude: -64.1805 },
    drawingPoints: start.drawingPoints,
    originElementId: start.originElementId,
    elements: [node, nap],
  })
  assert.equal(mid.action, "add-vertex")
  if (mid.action !== "add-vertex") return

  const finishOnNap = resolveDrawingElementClick({
    element: nap,
    drawingPoints: mid.drawingPoints,
    originElementId: mid.originElementId,
    elements: [node, nap],
  })
  assert.equal(finishOnNap.action, "finish")
  if (finishOnNap.action !== "finish") return
  assert.equal(finishOnNap.originElementId, "node-1")
  assert.equal(finishOnNap.destinationElementId, "nap-1")
  const last = finishOnNap.geometry[finishOnNap.geometry.length - 1]
  assert.equal(last.latitude, nap.latitude)
  assert.equal(last.longitude, nap.longitude)
  assert.equal(finishOnNap.geometry[0].latitude, node.latitude)
  assert.equal(finishOnNap.geometry[0].longitude, node.longitude)

  const finishOnNode = resolveDrawingElementClick({
    element: node,
    drawingPoints: [
      { latitude: -31.421, longitude: -64.181 },
      { latitude: -31.4205, longitude: -64.1805 },
    ],
    originElementId: "nap-1",
    elements: [node, nap],
  })
  assert.equal(finishOnNode.action, "finish")
  if (finishOnNode.action !== "finish") return
  assert.equal(finishOnNode.destinationElementId, "node-1")
  assert.equal(
    finishOnNode.geometry[finishOnNode.geometry.length - 1].latitude,
    node.latitude
  )
})

test("snap dentro de tolerancia usa la coordenada exacta del elemento", () => {
  const nap = { id: "nap-1", latitude: -31.42, longitude: -64.18 }
  const near = { latitude: -31.420001, longitude: -64.18 }
  const target = findSnapTarget(near, [nap])
  assert.equal(target?.id, "nap-1")

  const finished = resolveDrawingMapClick({
    click: near,
    drawingPoints: [{ latitude: -31.421, longitude: -64.181 }],
    originElementId: null,
    elements: [nap],
  })
  assert.equal(finished.action, "finish")
  if (finished.action !== "finish") return
  assert.equal(finished.destinationElementId, "nap-1")
  assert.equal(finished.geometry[1].latitude, nap.latitude)
  assert.equal(finished.geometry[1].longitude, nap.longitude)
})

test("selección normal no interfiere con el modo dibujo", () => {
  assert.equal(shouldSelectDesignElement("select"), true)
  assert.equal(shouldSelectDesignSegment("select"), true)
  assert.equal(shouldSelectDesignElement("draw-segment"), false)
  assert.equal(shouldSelectDesignSegment("draw-segment"), false)
  assert.equal(shouldSelectDesignElement("add-nap"), false)
  assert.equal(shouldSelectDesignElement("add-gain"), false)
  assert.equal(shouldSelectDesignGain("select"), true)
  assert.equal(shouldSelectDesignGain("add-gain"), false)
})

test("Escape cancela el dibujo y no crea un tramo incompleto", () => {
  const cancelled = cancelDesignDrawing()
  assert.deepEqual(cancelled.drawingPoints, [])
  assert.equal(cancelled.drawingOriginElementId, null)

  const ignored = resolveDrawingFinish({
    drawingPoints: [{ latitude: -31.42, longitude: -64.18 }],
    originElementId: "node-1",
    elements: [],
  })
  assert.equal(ignored.action, "ignore")
})

test("V1.1 persiste color, tipo y referencia de cable", () => {
  assert.deepEqual([...PROJECT_DESIGN_SEGMENT_TYPES], ["tendido", "drop", "otro"])

  const segment = mapCreateSegmentToInsert({
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    type: "drop",
    color: "#eab308",
    cableReference: "FO-12",
    geometry: [
      { latitude: -31.42, longitude: -64.18 },
      { latitude: -31.43, longitude: -64.19 },
    ],
  })
  assert.equal(segment.color, "#eab308")
  assert.equal(segment.type, "drop")
  assert.equal(segment.cable_reference, "FO-12")

  const updated = mapUpdateSegmentToUpdate({
    color: "#111827",
    type: "tendido",
    cableReference: "FO-24",
  })
  assert.equal(updated.color, "#111827")
  assert.equal(updated.type, "tendido")
  assert.equal(updated.cable_reference, "FO-24")
})

test("Guardar cierra el inspector; un error lo mantiene abierto", () => {
  const saved = resolveDesignInspectorAfterSave(true)
  assert.equal(saved.close, true)
  assert.equal(saved.selected, null)
  assert.equal(saved.tool, "select")

  const failed = resolveDesignInspectorAfterSave(false)
  assert.equal(failed.close, false)
})

test("Nodo y NAP permiten cambiar y persistir color", () => {
  const node = mapCreateElementToInsert({
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    kind: "node",
    name: "Nodo 1",
    latitude: -31.42,
    longitude: -64.18,
    color: "#eab308",
  })
  assert.equal(node.color, "#eab308")
  assert.equal(node.icon, DEFAULT_NODE_ICON)

  const nap = mapCreateElementToInsert({
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    kind: "nap",
    name: "NAP 1",
    latitude: -31.42,
    longitude: -64.18,
    color: "#eab308",
  })
  assert.equal(nap.color, "#eab308")

  const updated = mapUpdateElementToUpdate({ color: "#16a34a" })
  assert.equal(updated.color, "#16a34a")

  const invalid = prepareProjectDesignElementDraft({
    companyId: COMPANY_A,
    projectCompanyId: COMPANY_A,
    projectId: PROJECT_A,
    kind: "node",
    name: "Nodo 1",
    latitude: -31.42,
    longitude: -64.18,
    color: "amarillo",
  })
  assert.equal(invalid.ok, false)
})

test("colores recientes no se duplican, respetan el límite y se conservan", () => {
  const yellow = "#eab308"
  const red = "#dc2626"
  let recent = rememberProjectDesignRecentColor(yellow, [])
  assert.deepEqual(recent, [yellow])
  recent = rememberProjectDesignRecentColor(red, recent)
  assert.deepEqual(recent, [red, yellow])
  recent = rememberProjectDesignRecentColor(yellow, recent)
  assert.deepEqual(recent, [yellow, red])
  assert.equal(recent.filter((color) => color === yellow).length, 1)

  const overflow = ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666", "#777777", "#888888"]
  const limited = rememberProjectDesignRecentColor("#999999", overflow, 8)
  assert.equal(limited.length, 8)
  assert.equal(limited[0], "#999999")
  assert.equal(limited.includes("#888888"), false)

  const memory = new Map()
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value)
    },
  }
  persistProjectDesignRecentColor(yellow, storage)
  persistProjectDesignRecentColor(red, storage)
  const reloaded = readProjectDesignRecentColors(storage)
  assert.deepEqual(reloaded, [red, yellow])

  persistProjectDesignRecentColor(yellow, storage)
  const forNextNap = readProjectDesignRecentColors(storage)
  assert.equal(forNextNap[0], yellow)

  const invalidRecent = rememberProjectDesignRecentColor("nope", [yellow])
  assert.deepEqual(invalidRecent, [yellow])

  const written = writeProjectDesignRecentColors([yellow, yellow, "bad"], storage)
  assert.deepEqual(written, [yellow])
})

test("Nodo y NAP permiten cambiar icono y conservan un default válido", () => {
  assert.equal(resolveElementIcon("node", null), DEFAULT_NODE_ICON)
  assert.equal(resolveElementIcon("nap", null), DEFAULT_NAP_ICON)
  assert.equal(resolveElementIcon("node", "hexagon"), DEFAULT_NODE_ICON)
  assert.equal(resolveElementIcon("nap", "diamond"), DEFAULT_NAP_ICON)
  assert.equal(resolveElementIcon("node", "diamond"), "diamond")
  assert.equal(resolveElementIcon("nap", "hexagon"), "hexagon")

  const created = mapCreateElementToInsert({
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    kind: "node",
    name: "Nodo 1",
    latitude: -31.42,
    longitude: -64.18,
    icon: "diamond",
  })
  assert.equal(created.icon, "diamond")

  const row = mapProjectDesignElementRow(elementRow({ kind: "node", icon: null }))
  assert.equal(row.icon, DEFAULT_NODE_ICON)

  const napRow = mapProjectDesignElementRow(elementRow({ icon: "marker" }))
  assert.equal(napRow.icon, "marker")
  assert.equal(mapUpdateElementToUpdate({ icon: "square" }).icon, "square")

  const invalidIcon = prepareProjectDesignElementDraft({
    companyId: COMPANY_A,
    projectCompanyId: COMPANY_A,
    projectId: PROJECT_A,
    kind: "nap",
    name: "NAP 1",
    latitude: -31.42,
    longitude: -64.18,
    icon: "diamond",
  })
  assert.equal(invalidIcon.ok, false)

  for (const icon of ["square", "circle", "marker", "diamond", "hexagon"]) {
    const html = projectDesignElementMarkerHtml({
      name: "NAP 1",
      color: "#eab308",
      icon,
    })
    assert.match(html, /<svg /)
    assert.match(projectDesignElementShapeSvg({ icon, color: "#eab308" }), /<svg /)
  }
})

test("V1.2 persiste icono controlado", () => {
  assert.equal(PROJECT_DESIGN_ELEMENT_ICONS.includes("square"), true)
  assert.equal(PROJECT_DESIGN_ELEMENT_ICONS.includes("hexagon"), true)
  assert.equal(resolveElementIcon("node", "square"), "square")
  assert.equal(resolveElementIcon("nap", "hexagon"), "hexagon")

  const node = mapCreateElementToInsert({
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    kind: "node",
    name: "Nodo 1",
    latitude: -31.42,
    longitude: -64.18,
    icon: "square",
  })
  assert.equal(node.icon, "square")

  const updated = mapUpdateElementToUpdate({ icon: "hexagon" })
  assert.equal(updated.icon, "hexagon")
})

test("V1.3 persiste ganancias sin tocar planned_length_m ni PostGIS", () => {
  const queries = readFileSync(
    join(process.cwd(), "lib/supabase/project-design.queries.ts"),
    "utf8"
  )
  assert.match(queries, /from\("project_design_gains"\)/)
  assert.match(queries, /deleteProjectDesignGain/)
  assert.doesNotMatch(queries, /from\("tasks"\)/)
  assert.doesNotMatch(queries, /CREATE EXTENSION/i)
  assert.doesNotMatch(queries, /st_distance|postgis/i)

  const gain = mapCreateGainToInsert({
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    segmentId: "seg-1",
    gainM: 12,
    latitude: -31.42,
    longitude: -64.18,
    observations: "",
  })
  assert.equal(gain.gain_m, 12)
  assert.equal(gain.company_id, COMPANY_A)
  assert.equal("planned_length_m" in gain, false)
  assert.equal(parseProjectDesignGainMeters(-1), null)
  assert.equal(parseProjectDesignGainMeters(0), 0)

  const remaining = filterGainsAfterSegmentDelete(
    [{ segmentId: "seg-1" }, { segmentId: "seg-2" }],
    "seg-1"
  )
  assert.deepEqual(remaining, [{ segmentId: "seg-2" }])

  const lengthUpdate = mapUpdateSegmentToUpdate({ name: "Tramo 1" })
  assert.equal("planned_length_m" in lengthUpdate, false)
})

test("resumen: traza 1000 m sin ganancias = total 1000", () => {
  const summary = buildProjectDesignSummary(
    [{ kind: "node", gainM: 0 }],
    [{ plannedLengthM: 1000 }],
    []
  )
  assert.equal(summary.plannedLengthM, 1000)
  assert.equal(summary.traceGainM, 0)
  assert.equal(summary.elementGainM, 0)
  assert.equal(summary.totalCableM, 1000)
})

test("resumen: traza 1000 m + ganancia 10 = 1010; no altera tendido", () => {
  const summary = buildProjectDesignSummary(
    [{ kind: "nap", gainM: 0 }],
    [{ plannedLengthM: 1000 }],
    [{ gainM: 10 }]
  )
  assert.equal(summary.plannedLengthM, 1000)
  assert.equal(summary.traceGainM, 10)
  assert.equal(summary.totalCableM, 1010)
})

test("resumen: dos ganancias sobre la misma traza", () => {
  const summary = buildProjectDesignSummary(
    [],
    [{ plannedLengthM: 1000 }],
    [{ gainM: 10 }, { gainM: 15 }]
  )
  assert.equal(summary.plannedLengthM, 1000)
  assert.equal(summary.traceGainM, 25)
  assert.equal(summary.totalCableM, 1025)
})

test("resumen: NAP con ganancia 10 y varias NAP", () => {
  const oneNap = buildProjectDesignSummary(
    [{ kind: "nap", gainM: 10 }],
    [{ plannedLengthM: 1000 }],
    []
  )
  assert.equal(oneNap.elementGainM, 10)
  assert.equal(oneNap.totalCableM, 1010)

  const several = buildProjectDesignSummary(
    [
      { kind: "nap", gainM: 10 },
      { kind: "nap", gainM: 5 },
      { kind: "node", gainM: 0 },
    ],
    [{ plannedLengthM: 1000 }],
    []
  )
  assert.equal(several.elementGainM, 15)
  assert.equal(several.totalCableM, 1015)
})

test("resumen: ganancias de traza + NAP y gain 0 no suma", () => {
  const combined = buildProjectDesignSummary(
    [
      { kind: "nap", gainM: 10 },
      { kind: "nap", gainM: 0 },
    ],
    [{ plannedLengthM: 1000 }],
    [{ gainM: 15 }, { gainM: 0 }]
  )
  assert.equal(combined.plannedLengthM, 1000)
  assert.equal(combined.traceGainM, 15)
  assert.equal(combined.elementGainM, 10)
  assert.equal(combined.totalCableM, 1025)
})

test("eliminar ganancia o NAP recalcula el resumen", () => {
  const before = buildProjectDesignSummary(
    [{ kind: "nap", id: "nap-1", gainM: 10 }],
    [{ plannedLengthM: 1000 }],
    [
      { id: "g1", gainM: 15, segmentId: "seg-1" },
      { id: "g2", gainM: 5, segmentId: "seg-1" },
    ]
  )
  assert.equal(before.totalCableM, 1030)

  const afterGain = buildProjectDesignSummary(
    [{ kind: "nap", gainM: 10 }],
    [{ plannedLengthM: 1000 }],
    [{ gainM: 5 }]
  )
  assert.equal(afterGain.totalCableM, 1015)

  const afterNap = buildProjectDesignSummary(
    [],
    [{ plannedLengthM: 1000 }],
    [{ gainM: 15 }, { gainM: 5 }]
  )
  assert.equal(afterNap.elementGainM, 0)
  assert.equal(afterNap.totalCableM, 1020)
})

test("eliminar traza no deja ganancias huérfanas", () => {
  const remaining = filterGainsAfterSegmentDelete(
    [
      { segmentId: "seg-1" },
      { segmentId: "seg-2" },
      { segmentId: "seg-1" },
    ],
    "seg-1"
  )
  assert.equal(remaining.length, 1)
  assert.equal(remaining[0].segmentId, "seg-2")
  assert.match(buildProjectDesignSegmentDeleteMessage(2), /2 ganancias asociadas/)
})

test("la ganancia se proyecta sobre la traza y un clic lejos no crea", () => {
  const metersPerDegree = calculateGpsDistanceMeters(0, 0, 0, 1)
  const longitudeFor1000m = 1000 / metersPerDegree
  const geometry = [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: longitudeFor1000m },
  ]
  const segments = [{ id: "seg-1", geometry }]

  const mid = resolveGainPlacement({
    click: { latitude: 0.00008, longitude: longitudeFor1000m / 2 },
    segments,
  })
  assert.ok(mid)
  assert.equal(mid?.segmentId, "seg-1")
  assert.ok(Math.abs(mid?.latitude ?? 1) < 0.00001)
  assert.ok(Math.abs((mid?.longitude ?? 0) - longitudeFor1000m / 2) < 0.0002)
  assert.ok(Math.abs((mid?.distanceFromStartMeters ?? 0) - 500) < 5)

  const far = resolveGainPlacement({
    click: { latitude: 1, longitude: 0 },
    segments,
  })
  assert.equal(far, null)
})

test("parsea ganancia decimal y rechaza valores negativos", () => {
  assert.equal(parseProjectDesignGainMeters("12.5"), 12.5)
  assert.equal(parseProjectDesignGainMeters("12,5"), 12.5)
  assert.equal(parseProjectDesignGainMeters(""), 0)
  assert.equal(parseProjectDesignGainMeters(-1), null)
  assert.equal(formatGainMeters(12.5), "12,5 m")
  assert.equal(formatGainMeters(10), "10 m")
  assert.equal(DEFAULT_TRACE_GAIN_M, 10)

  const created = mapCreateGainToInsert({
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    segmentId: "seg-1",
    latitude: -31.42,
    longitude: -64.18,
    gainM: 15,
    observations: " reserva ",
  })
  assert.equal(created.gain_m, 15)
  assert.equal(created.observations, "reserva")
  assert.equal(created.segment_id, "seg-1")
  assert.equal(mapUpdateGainToUpdate({ gainM: 12.5 }).gain_m, 12.5)

  const row = mapProjectDesignGainRow({
    id: "g-1",
    company_id: COMPANY_A,
    project_id: PROJECT_A,
    segment_id: "seg-1",
    latitude: "-31.42",
    longitude: "-64.18",
    gain_m: "15.00",
    observations: null,
    created_at: "2026-09-14T00:00:00.000Z",
    updated_at: "2026-09-14T00:00:00.000Z",
  })
  assert.equal(row.gainM, 15)
  assert.equal(row.observations, "")

  const element = mapProjectDesignElementRow(elementRow())
  assert.equal(element.gainM, 0)

  const otherTrace = prepareProjectDesignGainDraft({
    companyId: COMPANY_A,
    projectCompanyId: COMPANY_A,
    projectId: PROJECT_A,
    segmentId: "seg-1",
    segmentProjectId: "other",
    latitude: -31.42,
    longitude: -64.18,
    gainM: 10,
  })
  assert.equal(otherTrace.ok, false)
})
