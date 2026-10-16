import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

import { mapMobileTaskDetailResponse } from "../lib/mobile/v1/tasks/task-detail-mapper.ts"
import { resolveMobileTaskProjectGpsFields } from "../lib/mobile/v1/tasks/task-project-gps-fields.ts"

const PROJECT_ID = "11111111-1111-4111-8111-111111111111"
const TASK_LAT = -31.42
const TASK_LNG = -64.18
const OBRA_LAT = -31.48426
const OBRA_LNG = -64.16923

const TASK_SERVICE_PATH = join(
  process.cwd(),
  "lib/mobile/v1/tasks/task-service.ts"
)
const FETCH_PATH = join(
  process.cwd(),
  "lib/mobile/v1/tasks/resolve-task-start-coordinates.ts"
)
const MAPPER_PATH = join(
  process.cwd(),
  "lib/mobile/v1/tasks/task-detail-mapper.ts"
)

function baseTask(overrides = {}) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    code: "TSK-FO-001",
    title: "Tendido",
    description: "",
    projectId: PROJECT_ID,
    projectCode: "FO-PRUEBA-01",
    projectName: "PRUEBA-01",
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
    latitude: TASK_LAT,
    longitude: TASK_LNG,
    serviceAddress: "Calle 1",
    locality: "Córdoba",
    observationsForCrew: "",
    workOrderNumber: "WO-1",
    customerName: "Cliente",
    operationalSteps: [],
    taskMetadata: {},
    ...overrides,
  }
}

function mapDetail(taskOverrides = {}, projectGps = null) {
  return mapMobileTaskDetailResponse(
    /** @type {any} */ (baseTask(taskOverrides)),
    null,
    [],
    [],
    false,
    projectGps
  )
}

test("1. OT con GPS propio + Obra con GPS llegan separados", () => {
  const detail = mapDetail(
    { latitude: TASK_LAT, longitude: TASK_LNG, projectId: PROJECT_ID },
    { latitude: OBRA_LAT, longitude: OBRA_LNG }
  )

  assert.equal(detail.latitude, TASK_LAT)
  assert.equal(detail.longitude, TASK_LNG)
  assert.equal(detail.projectLatitude, OBRA_LAT)
  assert.equal(detail.projectLongitude, OBRA_LNG)
  assert.notEqual(detail.latitude, detail.projectLatitude)
  assert.notEqual(detail.longitude, detail.projectLongitude)
})

test("2. OT sin GPS + Obra con GPS: OT null y Obra presente", () => {
  const detail = mapDetail(
    { latitude: undefined, longitude: undefined, projectId: PROJECT_ID },
    { latitude: OBRA_LAT, longitude: OBRA_LNG }
  )

  assert.equal(detail.latitude, null)
  assert.equal(detail.longitude, null)
  assert.equal(detail.projectLatitude, OBRA_LAT)
  assert.equal(detail.projectLongitude, OBRA_LNG)
})

test("3. OT con GPS + Obra sin GPS: OT presente y Obra null", () => {
  const detail = mapDetail(
    { latitude: TASK_LAT, longitude: TASK_LNG, projectId: PROJECT_ID },
    { latitude: null, longitude: null }
  )

  assert.equal(detail.latitude, TASK_LAT)
  assert.equal(detail.longitude, TASK_LNG)
  assert.equal(detail.projectLatitude, null)
  assert.equal(detail.projectLongitude, null)
})

test("4. OT sin GPS + Obra sin GPS: ambos null", () => {
  const detail = mapDetail(
    { latitude: null, longitude: null, projectId: PROJECT_ID },
    { latitude: null, longitude: null }
  )

  assert.equal(detail.latitude, null)
  assert.equal(detail.longitude, null)
  assert.equal(detail.projectLatitude, null)
  assert.equal(detail.projectLongitude, null)
})

test("5. OT que no pertenece a una Obra: project GPS null", () => {
  const detail = mapDetail(
    {
      projectId: undefined,
      projectName: "",
      latitude: TASK_LAT,
      longitude: TASK_LNG,
    },
    { latitude: OBRA_LAT, longitude: OBRA_LNG }
  )

  assert.equal(detail.latitude, TASK_LAT)
  assert.equal(detail.longitude, TASK_LNG)
  assert.equal(detail.projectLatitude, null)
  assert.equal(detail.projectLongitude, null)
  assert.equal(detail.isProjectTask, false)
})

test("resolver no copia GPS de Obra sobre latitude/longitude", () => {
  const fields = resolveMobileTaskProjectGpsFields({
    projectId: PROJECT_ID,
    project: { latitude: OBRA_LAT, longitude: OBRA_LNG },
  })

  assert.deepEqual(fields, {
    projectLatitude: OBRA_LAT,
    projectLongitude: OBRA_LNG,
  })
  assert.equal("latitude" in fields, false)
  assert.equal("longitude" in fields, false)
})

test("detalle de OT no reemplaza GPS propio con GPS de Obra", () => {
  const mapper = readFileSync(MAPPER_PATH, "utf8")
  assert.match(mapper, /latitude:\s*task\.latitude\s*\?\?\s*null/)
  assert.match(mapper, /longitude:\s*task\.longitude\s*\?\?\s*null/)
  assert.match(mapper, /resolveMobileTaskProjectGpsFields/)
  assert.doesNotMatch(mapper, /latitude:\s*projectGps/)
})

test("task service reutiliza fetch de GPS de Obra con tenant", () => {
  const service = readFileSync(TASK_SERVICE_PATH, "utf8")
  const fetchSource = readFileSync(FETCH_PATH, "utf8")

  assert.match(
    service,
    /fetchProjectGpsForCompany\(admin,\s*auth\.companyId,\s*task\.projectId\)/
  )
  assert.match(
    service,
    /from "@\/lib\/mobile\/v1\/tasks\/resolve-task-start-coordinates"/
  )
  assert.match(fetchSource, /export async function fetchProjectGpsForCompany/)
  assert.match(fetchSource, /\.from\("projects"\)/)
  assert.match(fetchSource, /\.select\("latitude, longitude"\)/)
  assert.match(fetchSource, /\.eq\("id", projectId\)/)
  assert.match(fetchSource, /\.eq\("company_id", companyId\)/)
  assert.match(fetchSource, /\.is\("deleted_at", null\)/)
})
