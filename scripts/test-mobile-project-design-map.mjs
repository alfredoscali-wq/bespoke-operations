import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { mapMobileProjectDesignMap } from "../lib/mobile/v1/projects/map-project-design.ts"
import {
  resolveMobileProjectMapBinding,
  validateMobileProjectMapRequest,
} from "../lib/mobile/v1/projects/project-map-access.ts"
import { mapMobileTaskDetailResponse } from "../lib/mobile/v1/tasks/task-detail-mapper.ts"
import { resolveMobileTaskProjectDesignFields } from "../lib/mobile/v1/tasks/task-design-fields.ts"
import { MobileApiError } from "../lib/mobile/v1/errors.ts"

const PROJECT_A = "11111111-1111-4111-8111-111111111111"
const PROJECT_B = "11111111-1111-4111-8111-111111111112"
const T01 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"
const T02 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"
const T03 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3"
const T04 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4"
const NODE_ID = "22222222-2222-4222-8222-222222222221"
const NAP_ID = "22222222-2222-4222-8222-222222222222"
const GAIN_T01 = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1"
const TASK_ID = "33333333-3333-4333-8333-333333333333"

const MAP_ROUTE_PATH = join(
  process.cwd(),
  "app/api/mobile/v1/projects/[projectId]/map/route.ts"
)
const TASK_DETAIL_ROUTE_PATH = join(
  process.cwd(),
  "app/api/mobile/v1/tasks/[taskId]/route.ts"
)

function baseTask(overrides = {}) {
  return {
    id: TASK_ID,
    code: "OBR-001-001",
    title: "Instalación",
    description: "",
    projectId: undefined,
    projectCode: "",
    projectName: "",
    type: "fiber",
    status: "asignada",
    priority: "media",
    supervisor: "Ana",
    crew: "Cuadrilla 1",
    startDate: "2026-09-14",
    dueDate: "2026-09-14",
    estimatedDuration: "",
    serviceType: "instalacion-nueva",
    contractedPlan: "20Mb",
    amountToCollect: 0,
    latitude: -31.42,
    longitude: -64.18,
    serviceAddress: "Calle 1",
    locality: "Córdoba",
    observationsForCrew: "Llevar EPP",
    workOrderNumber: "WO-1",
    customerName: "Cliente",
    operationalSteps: [],
    taskMetadata: {},
    ...overrides,
  }
}

function element(overrides = {}) {
  return {
    id: NODE_ID,
    companyId: "co-1",
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
    updatedAt: "2026-09-14T10:00:00.000Z",
    ...overrides,
  }
}

function segment(overrides = {}) {
  return {
    id: T01,
    companyId: "co-1",
    projectId: PROJECT_A,
    originElementId: NODE_ID,
    destinationElementId: NAP_ID,
    name: "T-01",
    type: "tendido",
    cableReference: "FO-24",
    color: "#2563eb",
    notes: "",
    geometry: [
      { latitude: -31.42, longitude: -64.18 },
      { latitude: -31.43, longitude: -64.19 },
    ],
    plannedLengthM: 650,
    displayOrder: 0,
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-14T11:00:00.000Z",
    ...overrides,
  }
}

function gain(overrides = {}) {
  return {
    id: GAIN_T01,
    companyId: "co-1",
    projectId: PROJECT_A,
    segmentId: T01,
    latitude: -31.425,
    longitude: -64.185,
    gainM: 10,
    observations: "",
    createdAt: "2026-09-13T00:00:00.000Z",
    updatedAt: "2026-09-14T12:00:00.000Z",
    ...overrides,
  }
}

function designSnapshot() {
  return {
    elements: [
      element(),
      element({
        id: NAP_ID,
        kind: "nap",
        name: "NAP-01",
        latitude: -31.43,
        longitude: -64.19,
        icon: "circle",
        color: "#2563eb",
        gainM: 25,
      }),
    ],
    segments: [
      segment({ id: T01, name: "T-01" }),
      segment({
        id: T02,
        name: "T-02",
        geometry: [
          { latitude: -31.43, longitude: -64.19 },
          { latitude: -31.44, longitude: -64.2 },
        ],
        plannedLengthM: 450,
      }),
      segment({
        id: T03,
        name: "T-03",
        geometry: [
          { latitude: -31.44, longitude: -64.2 },
          { latitude: -31.45, longitude: -64.21 },
        ],
        plannedLengthM: 500,
      }),
      segment({
        id: T04,
        name: "T-04",
        type: "drop",
        geometry: [
          { latitude: -31.45, longitude: -64.21 },
          { latitude: -31.451, longitude: -64.211 },
        ],
        plannedLengthM: 80,
      }),
    ],
    gains: [gain()],
  }
}

function mapDetail(overrides = {}) {
  return mapMobileTaskDetailResponse(
    /** @type {any} */ (baseTask(overrides)),
    null,
    [],
    [],
    false
  )
}

test("A. GET detalle OT normal sigue funcionando y no expone diseño", () => {
  const detail = mapDetail()
  assert.equal(detail.id, TASK_ID)
  assert.equal(detail.status, "asignada")
  assert.equal(detail.address, "Calle 1")
  assert.equal(detail.hasActiveIncident, false)
  assert.equal(detail.projectId, null)
  assert.equal(detail.projectName, null)
  assert.equal(detail.isProjectTask, false)
  assert.equal(detail.projectDesignWorkType, null)
  assert.equal(detail.projectDesignSource, null)
  assert.equal("taskMetadata" in detail, false)
  assert.equal(JSON.stringify(detail).includes("geometry"), false)
})

test("B. GET detalle OT Tendido proyecta projectId, source y segmentIds", () => {
  const detail = mapDetail({
    projectId: PROJECT_A,
    projectName: "Obra Norte",
    title: "Tendido",
    taskMetadata: {
      operationalChecklistTemplate: [{ id: "chk-1", title: "Casco" }],
      materialsNeeded: "cinta",
      projectDesignWorkType: "tendido",
      projectDesignSource: {
        kind: "segments",
        segmentIds: [T01, T02, T03],
      },
      projectDesignPlanSnapshot: {
        capturedAt: "2026-09-14T12:00:00.000Z",
        workType: "tendido",
        segmentIds: [T01, T02, T03],
        segments: [
          {
            id: T01,
            label: "T-01",
            type: "tendido",
            plannedLengthM: 650,
            geometry: [{ latitude: 1, longitude: 2 }],
          },
        ],
        gainIds: [],
        plannedLengthM: 1600,
        traceGainM: 15,
        plannedCableM: 1615,
      },
    },
  })

  assert.equal(detail.projectId, PROJECT_A)
  assert.equal(detail.projectName, "Obra Norte")
  assert.equal(detail.isProjectTask, true)
  assert.equal(detail.projectDesignWorkType, "tendido")
  assert.deepEqual(detail.projectDesignSource, {
    kind: "segments",
    segmentIds: [T01, T02, T03],
  })
  assert.equal("taskMetadata" in detail, false)
  assert.equal(JSON.stringify(detail).includes("geometry"), false)
  assert.equal(JSON.stringify(detail).includes("plannedCableM"), false)
})

test("C. OT de Obra sin Diseño no rompe y deja campos nulos", () => {
  const detail = mapDetail({
    projectId: PROJECT_A,
    projectName: "Obra Norte",
    taskMetadata: { materialsNeeded: "cinta" },
  })
  assert.equal(detail.projectId, PROJECT_A)
  assert.equal(detail.projectName, "Obra Norte")
  assert.equal(detail.isProjectTask, true)
  assert.equal(detail.projectDesignWorkType, null)
  assert.equal(detail.projectDesignSource, null)
})

test("Node/NAP existente no se rompe y proyecta source tipado", () => {
  const detail = mapDetail({
    projectId: PROJECT_A,
    projectName: "Obra Norte",
    taskMetadata: {
      projectDesignWorkType: "nap",
      projectDesignSource: {
        kind: "nap",
        elementId: NAP_ID,
        proposalId: "prop-nap",
        identifier: "NAP-01",
        plannedGainM: 10,
      },
    },
  })
  assert.equal(detail.projectDesignWorkType, "nap")
  assert.deepEqual(detail.projectDesignSource, {
    kind: "nap",
    elementId: NAP_ID,
    identifier: "NAP-01",
  })
  assert.equal(
    JSON.stringify(detail.projectDesignSource).includes("proposalId"),
    false
  )
})

test("D. mapa de OT Tendido válida devuelve diseño completo", () => {
  const mapped = mapMobileProjectDesignMap({
    projectId: PROJECT_A,
    projectName: "Obra Norte",
    snapshot: designSnapshot(),
  })

  assert.equal(mapped.projectId, PROJECT_A)
  assert.equal(mapped.projectName, "Obra Norte")
  assert.equal(mapped.segments.length, 4)
  assert.deepEqual(
    mapped.segments.map((item) => item.id),
    [T01, T02, T03, T04]
  )
  assert.equal(mapped.elements.length, 2)
  assert.deepEqual(
    mapped.elements.map((item) => item.kind).sort(),
    ["nap", "node"]
  )
  assert.equal(mapped.gains.length, 1)
  assert.equal(mapped.gains[0].segmentId, T01)
  assert.equal(mapped.gains[0].gainM, 10)
  assert.ok(mapped.boundingBox)
  assert.equal(mapped.designVersion, Date.parse("2026-09-14T12:00:00.000Z"))
  assert.equal(mapped.updatedAt, "2026-09-14T12:00:00.000Z")
})

test("D. mapa vacío de Diseño no rompe", () => {
  const mapped = mapMobileProjectDesignMap({
    projectId: PROJECT_A,
    projectName: "Obra Norte",
    snapshot: { elements: [], segments: [], gains: [] },
  })
  assert.deepEqual(mapped.segments, [])
  assert.deepEqual(mapped.elements, [])
  assert.deepEqual(mapped.gains, [])
  assert.equal(mapped.boundingBox, null)
  assert.equal(mapped.designVersion, 0)
  assert.equal(mapped.updatedAt, null)
})

test("E. seguridad: projectId incorrecto o task sin obra se rechazan", () => {
  assert.deepEqual(
    resolveMobileProjectMapBinding({
      taskProjectId: PROJECT_A,
      pathProjectId: PROJECT_B,
    }),
    { ok: false }
  )
  assert.deepEqual(
    resolveMobileProjectMapBinding({
      taskProjectId: null,
      pathProjectId: PROJECT_A,
    }),
    { ok: false }
  )
  assert.deepEqual(
    resolveMobileProjectMapBinding({
      taskProjectId: "",
      pathProjectId: PROJECT_A,
    }),
    { ok: false }
  )
  assert.deepEqual(
    resolveMobileProjectMapBinding({
      taskProjectId: PROJECT_A,
      pathProjectId: PROJECT_A,
    }),
    { ok: true, projectId: PROJECT_A }
  )
})

test("E. task de otro tenant / sin autorización se modela como not-found", () => {
  assert.equal(
    resolveMobileProjectMapBinding({
      taskProjectId: undefined,
      pathProjectId: PROJECT_A,
    }).ok,
    false
  )
})

test("F. coordinates salen del Diseño y no se copian a la OT", () => {
  const snapshot = designSnapshot()
  const mapped = mapMobileProjectDesignMap({
    projectId: PROJECT_A,
    projectName: "Obra Norte",
    snapshot,
  })
  const t01 = mapped.segments.find((item) => item.id === T01)
  assert.deepEqual(t01?.coordinates, snapshot.segments[0].geometry)
  assert.equal("geometry" in (t01 ?? {}), false)
  assert.equal(t01?.plannedLengthM, snapshot.segments[0].plannedLengthM)

  const detail = mapDetail({
    projectId: PROJECT_A,
    projectName: "Obra Norte",
    taskMetadata: {
      projectDesignWorkType: "tendido",
      projectDesignSource: { kind: "segments", segmentIds: [T01] },
    },
  })
  assert.equal("geometry" in detail, false)
  assert.equal("projectDesignPlanSnapshot" in detail, false)
})

test("G. segmentIds salen de metadata server-side; el request de mapa no acepta segmentIds", () => {
  const fields = resolveMobileTaskProjectDesignFields(
    /** @type {any} */ (
      baseTask({
        projectId: PROJECT_A,
        projectName: "Obra Norte",
        taskMetadata: {
          projectDesignSource: {
            kind: "segments",
            segmentIds: [T01, T02, T03],
          },
        },
      })
    )
  )
  assert.deepEqual(fields.projectDesignSource, {
    kind: "segments",
    segmentIds: [T01, T02, T03],
  })

  const request = validateMobileProjectMapRequest(
    PROJECT_A,
    TASK_ID,
    "device-1"
  )
  assert.deepEqual(Object.keys(request).sort(), [
    "deviceId",
    "projectId",
    "taskId",
  ])
  assert.equal("segmentIds" in request, false)

  const route = readFileSync(MAP_ROUTE_PATH, "utf8")
  assert.match(route, /searchParams\.get\("taskId"\)/)
  assert.match(route, /searchParams\.get\("deviceId"\)/)
  assert.doesNotMatch(route, /segmentIds/)
  assert.match(route, /handleProtectedMobileRoute/)

  const detailRoute = readFileSync(TASK_DETAIL_ROUTE_PATH, "utf8")
  assert.match(detailRoute, /getMobileTaskDetail/)
})

test("validateMobileProjectMapRequest exige taskId y deviceId", () => {
  assert.throws(
    () => validateMobileProjectMapRequest(PROJECT_A, null, "device-1"),
    (error) =>
      error instanceof MobileApiError && error.status === 400
  )
  assert.throws(
    () => validateMobileProjectMapRequest("", TASK_ID, "device-1"),
    (error) =>
      error instanceof MobileApiError && error.status === 400
  )
})

test("gains de otra traza no incluida en el snapshot no se exponen", () => {
  const mapped = mapMobileProjectDesignMap({
    projectId: PROJECT_A,
    projectName: "Obra Norte",
    snapshot: {
      elements: [],
      segments: [segment({ id: T01, name: "T-01" })],
      gains: [
        gain({ segmentId: T01 }),
        gain({ id: "gain-foreign", segmentId: "missing-segment", gainM: 99 }),
      ],
    },
  })
  assert.equal(mapped.gains.length, 1)
  assert.equal(mapped.gains[0].segmentId, T01)
})

const EXISTING_SEGMENT_FIELDS = [
  "id",
  "label",
  "type",
  "color",
  "cableReference",
  "coordinates",
]

test("1-5. segmento completo conserva plannedLengthM, origen, destino y notes trim", () => {
  const mapped = mapMobileProjectDesignMap({
    projectId: PROJECT_A,
    projectName: "Obra Norte",
    snapshot: {
      elements: [element(), element({ id: NAP_ID, kind: "nap", name: "NAP-01" })],
      segments: [
        segment({
          id: T01,
          name: "T-01",
          plannedLengthM: 650.75,
          originElementId: NODE_ID,
          destinationElementId: NAP_ID,
          notes: "  Cruza por avenida  ",
        }),
      ],
      gains: [],
    },
  })
  const t01 = mapped.segments[0]
  assert.equal(mapped.segments.length, 1)
  assert.equal(t01.plannedLengthM, 650.75)
  assert.equal(t01.originElementId, NODE_ID)
  assert.equal(t01.destinationElementId, NAP_ID)
  assert.equal(t01.notes, "Cruza por avenida")
  for (const field of EXISTING_SEGMENT_FIELDS) {
    assert.equal(field in t01, true, `falta campo existente ${field}`)
  }
})

test("6-8. origin/destination null y notes vacío", () => {
  const mapped = mapMobileProjectDesignMap({
    projectId: PROJECT_A,
    projectName: "Obra Norte",
    snapshot: {
      elements: [],
      segments: [
        segment({
          id: T02,
          name: "T-02",
          originElementId: null,
          destinationElementId: null,
          notes: "   ",
          plannedLengthM: 450,
        }),
      ],
      gains: [],
    },
  })
  const t02 = mapped.segments[0]
  assert.equal(t02.originElementId, null)
  assert.equal(t02.destinationElementId, null)
  assert.equal(t02.notes, "")
  assert.equal(t02.plannedLengthM, 450)
})

test("9-10. campos existentes y payload de mapa siguen válidos", () => {
  const mapped = mapMobileProjectDesignMap({
    projectId: PROJECT_A,
    projectName: "Obra Norte",
    snapshot: designSnapshot(),
  })
  const t01 = mapped.segments.find((item) => item.id === T01)
  assert.ok(t01)
  for (const field of EXISTING_SEGMENT_FIELDS) {
    assert.equal(field in t01, true)
  }
  assert.equal(t01.label, "T-01")
  assert.equal(t01.type, "tendido")
  assert.equal(typeof t01.color, "string")
  assert.equal(t01.cableReference, "FO-24")
  assert.ok(Array.isArray(t01.coordinates))
  assert.equal(t01.coordinates.length >= 2, true)

  assert.equal(mapped.projectId, PROJECT_A)
  assert.equal(mapped.projectName, "Obra Norte")
  assert.equal(typeof mapped.designVersion, "number")
  assert.equal(typeof mapped.updatedAt, "string")
  assert.ok(mapped.boundingBox)
  assert.ok(Array.isArray(mapped.segments))
  assert.ok(Array.isArray(mapped.elements))
  assert.ok(Array.isArray(mapped.gains))
})

test("11. el mapper de mapa no filtra segmentos por highlight/OT", () => {
  const mapper = readFileSync(
    join(process.cwd(), "lib/mobile/v1/projects/map-project-design.ts"),
    "utf8"
  )
  const service = readFileSync(
    join(process.cwd(), "lib/mobile/v1/projects/project-map-service.ts"),
    "utf8"
  )
  assert.doesNotMatch(mapper, /highlightedSegmentIds/)
  assert.doesNotMatch(mapper, /projectDesignSource/)
  assert.match(mapper, /input\.snapshot\.segments\.map/)
  assert.doesNotMatch(service, /segmentIds/)
  const mapped = mapMobileProjectDesignMap({
    projectId: PROJECT_A,
    projectName: "Obra Norte",
    snapshot: designSnapshot(),
  })
  assert.equal(mapped.segments.length, 4)
})

test("12. autorización del endpoint de mapa no cambia", () => {
  const route = readFileSync(MAP_ROUTE_PATH, "utf8")
  const access = readFileSync(
    join(process.cwd(), "lib/mobile/v1/projects/project-map-access.ts"),
    "utf8"
  )
  assert.match(route, /handleProtectedMobileRoute/)
  assert.match(route, /validateMobileProjectMapRequest/)
  assert.match(route, /getMobileProjectMap/)
  assert.match(access, /assertMobileTaskExecutionAccess|taskId/)
  assert.deepEqual(
    resolveMobileProjectMapBinding({
      taskProjectId: PROJECT_B,
      pathProjectId: PROJECT_A,
    }),
    { ok: false }
  )
  assert.throws(
    () => validateMobileProjectMapRequest(PROJECT_A, null, "device-1"),
    (error) =>
      error instanceof MobileApiError && error.status === 400
  )
})
