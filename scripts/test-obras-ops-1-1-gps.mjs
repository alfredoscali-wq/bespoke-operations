import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  mapCreatePayloadToInsert,
  mapProjectRowToProject,
  mapUpdatePayloadToUpdate,
} from "../lib/supabase/projects.mapper.ts"
import {
  hasProjectGps,
  PROJECT_GPS_REQUIRED_TO_START_MESSAGE,
  validateProjectGpsPair,
} from "../lib/projects/project-gps.ts"
import {
  validateStartProjectDispatch,
  resolveProjectTaskCreateStatus,
  shouldApplyPlanningQueueSideEffectsForTask,
} from "../lib/projects/project-start-dispatch.ts"
import {
  buildTaskStartLocationRequiredMessage,
  resolveTaskStartCoordinatesFromSources,
} from "../lib/mobile/v1/tasks/task-start-coordinates.ts"
import {
  calculateDistanceMeters,
  isWithinTaskStartRadius,
  TASK_START_MAX_DISTANCE_METERS,
} from "../lib/mobile/v1/tasks/geo-utils.ts"
import { isFieldAgentAgendaTaskVisible } from "../lib/mobile/v1/agenda/agenda-task-visibility.ts"

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20261003000100_obras_ops_1_1_project_gps.sql"
)

const OPS_1_0_PATH = join(
  process.cwd(),
  "supabase/migrations/20261001000100_obras_ops_1_0_start_project_dispatch.sql"
)

const HOTFIX_PATH = join(
  process.cwd(),
  "supabase/migrations/20261002000100_obras_ops_1_0_active_project_task_status_hotfix.sql"
)

const LAT = 25.6866
const LNG = -100.3161

function baseRow(overrides = {}) {
  return {
    id: "proj-1",
    company_id: "company-a",
    code: "OB-001",
    name: "Obra Norte",
    client: "Cliente",
    type: "fiber",
    status: "planned",
    progress: 0,
    start_date: null,
    end_date: null,
    supervisor: "Supervisor",
    location: "Monterrey",
    latitude: null,
    longitude: null,
    description: "",
    pause_reason: null,
    pause_notes: null,
    paused_at: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  }
}

function makeDispatchTask(overrides = {}) {
  return {
    id: "task-1",
    code: "TSK-1",
    status: "programada",
    crewId: "crew-1",
    dueDate: "2026-07-11",
    projectId: "proj-1",
    ...overrides,
  }
}

test("1. crear Obra sin GPS → permitido (mapper insert null/null)", () => {
  const insert = mapCreatePayloadToInsert({
    name: "Obra",
    code: "OB-NO-GPS",
    client: "Cliente",
    type: "fiber",
    location: "Monterrey",
    description: "",
    supervisor: "Sup",
  })

  assert.equal(insert.latitude, null)
  assert.equal(insert.longitude, null)
  assert.equal(validateProjectGpsPair({ latitude: null, longitude: null }).ok, true)
})

test("2. crear Obra con GPS válido → permitido", () => {
  const insert = mapCreatePayloadToInsert({
    name: "Obra",
    code: "OB-GPS",
    client: "Cliente",
    type: "fiber",
    location: "Monterrey",
    description: "",
    supervisor: "Sup",
    latitude: LAT,
    longitude: LNG,
  })

  assert.equal(insert.latitude, LAT)
  assert.equal(insert.longitude, LNG)
  assert.equal(hasProjectGps(insert), true)
})

test("3. coordenadas parciales → rechazadas por helper (mirror DB pair check)", () => {
  const onlyLat = validateProjectGpsPair({ latitude: LAT, longitude: null })
  assert.equal(onlyLat.ok, false)

  const onlyLng = validateProjectGpsPair({ latitude: null, longitude: LNG })
  assert.equal(onlyLng.ok, false)
})

test("4. latitude fuera de rango → rechazada", () => {
  const result = validateProjectGpsPair({ latitude: 91, longitude: LNG })
  assert.equal(result.ok, false)
})

test("5. longitude fuera de rango → rechazada", () => {
  const result = validateProjectGpsPair({ latitude: LAT, longitude: 181 })
  assert.equal(result.ok, false)
})

test("6. editar Obra histórica y agregar GPS → permitido", () => {
  const historical = mapProjectRowToProject(
    baseRow({ status: "closed", latitude: null, longitude: null })
  )
  assert.equal(hasProjectGps(historical), false)

  const update = mapUpdatePayloadToUpdate({
    latitude: LAT,
    longitude: LNG,
  })
  assert.equal(update.latitude, LAT)
  assert.equal(update.longitude, LNG)
})

test("7. editar Obra active y agregar/corregir GPS → permitido", () => {
  const active = mapProjectRowToProject(
    baseRow({ status: "active", latitude: 25.1, longitude: -100.1 })
  )
  assert.equal(hasProjectGps(active), true)

  const corrected = mapUpdatePayloadToUpdate({
    latitude: LAT,
    longitude: LNG,
  })
  assert.equal(corrected.latitude, LAT)
  assert.equal(corrected.longitude, LNG)
})

test("8. iniciar Obra planned sin GPS → rechazado", () => {
  const result = validateStartProjectDispatch({
    projectStatus: "planned",
    tasks: [makeDispatchTask()],
    latitude: null,
    longitude: null,
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.message, PROJECT_GPS_REQUIRED_TO_START_MESSAGE)
  }
})

test("9. iniciar Obra planned con GPS → permitido", () => {
  const result = validateStartProjectDispatch({
    projectStatus: "planned",
    tasks: [makeDispatchTask()],
    latitude: LAT,
    longitude: LNG,
  })

  assert.equal(result.ok, true)
})

test("10. fallo GPS al Iniciar Obra → RPC valida antes de mutar (migración)", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8")

  assert.match(sql, /latitude IS NULL OR v_project\.longitude IS NULL/)
  assert.match(sql, /ubicación GPS antes de poder iniciarse/)
  // Status update happens after GPS check in source order
  const gpsIdx = sql.indexOf("ubicación GPS")
  const updateIdx = sql.indexOf("status = 'active'")
  assert.ok(gpsIdx > 0 && updateIdx > gpsIdx)
})

test("11. tarea de Obra resuelve coordenadas desde project", () => {
  const resolved = resolveTaskStartCoordinatesFromSources({
    task: {
      projectId: "proj-1",
      latitude: 1,
      longitude: 2,
    },
    project: { latitude: LAT, longitude: LNG },
  })

  assert.deepEqual(resolved, {
    latitude: LAT,
    longitude: LNG,
    source: "project",
  })
})

test("12. tarea de Obra NO usa task.latitude/longitude como fuente principal", () => {
  const resolved = resolveTaskStartCoordinatesFromSources({
    task: {
      projectId: "proj-1",
      latitude: 10,
      longitude: 20,
    },
    project: { latitude: LAT, longitude: LNG },
  })

  assert.equal(resolved?.source, "project")
  assert.notEqual(resolved?.latitude, 10)
  assert.notEqual(resolved?.longitude, 20)
})

test("13. OT normal sigue usando task.latitude/longitude", () => {
  const resolved = resolveTaskStartCoordinatesFromSources({
    task: {
      projectId: null,
      latitude: LAT,
      longitude: LNG,
    },
    project: null,
  })

  assert.deepEqual(resolved, {
    latitude: LAT,
    longitude: LNG,
    source: "task",
  })
})

test("14. Project de otro tenant → no puede resolver GPS (project null tras filtro)", () => {
  const resolved = resolveTaskStartCoordinatesFromSources({
    task: {
      projectId: "proj-other",
      latitude: null,
      longitude: null,
    },
    project: null,
  })

  assert.equal(resolved, null)
})

test("15. Project deleted → no puede resolver GPS", () => {
  const resolved = resolveTaskStartCoordinatesFromSources({
    task: {
      projectId: "proj-1",
      latitude: null,
      longitude: null,
    },
    project: null,
  })

  assert.equal(resolved, null)
})

test("16. tarea histórica con relación inválida → no obtiene GPS", () => {
  const resolved = resolveTaskStartCoordinatesFromSources({
    task: {
      projectId: "missing-project",
      latitude: LAT,
      longitude: LNG,
    },
    project: null,
  })

  assert.equal(resolved, null)
})

test("17. Obra active histórica recibe GPS → tarea existente lo utiliza inmediatamente", () => {
  const before = resolveTaskStartCoordinatesFromSources({
    task: { projectId: "proj-1", latitude: null, longitude: null },
    project: { latitude: null, longitude: null },
  })
  assert.equal(before, null)

  const after = resolveTaskStartCoordinatesFromSources({
    task: { projectId: "proj-1", latitude: null, longitude: null },
    project: { latitude: LAT, longitude: LNG },
  })
  assert.equal(after?.source, "project")
  assert.equal(after?.latitude, LAT)
})

test("18. operario dentro de 50 m → inicio permitido", () => {
  assert.equal(TASK_START_MAX_DISTANCE_METERS, 50)
  assert.equal(
    isWithinTaskStartRadius(LAT, LNG, LAT, LNG),
    true
  )
})

test("19. operario fuera de 50 m → rechazo existente", () => {
  const farLat = LAT + 0.01
  const distance = calculateDistanceMeters(farLat, LNG, LAT, LNG)
  assert.ok(distance > 50)
  assert.equal(isWithinTaskStartRadius(farLat, LNG, LAT, LNG), false)
})

test("20. sin GPS de Obra → TASK_LOCATION_REQUIRED message", () => {
  const resolved = resolveTaskStartCoordinatesFromSources({
    task: { projectId: "proj-1", latitude: null, longitude: null },
    project: { latitude: null, longitude: null },
  })
  assert.equal(resolved, null)
  assert.match(
    buildTaskStartLocationRequiredMessage(true),
    /Obra no tiene ubicación GPS/i
  )
})

test("21. OT normal sin GPS → comportamiento existente sin cambios", () => {
  const resolved = resolveTaskStartCoordinatesFromSources({
    task: { projectId: null, latitude: null, longitude: null },
    project: null,
  })
  assert.equal(resolved, null)
  assert.equal(
    buildTaskStartLocationRequiredMessage(false),
    "La orden de trabajo no tiene ubicación registrada."
  )
})

test("22. RPC de despacho sigue promoviendo tareas correctamente", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8")
  assert.match(sql, /status = 'asignada'::public\.task_status/)
  assert.match(sql, /t\.status = 'programada'::public\.task_status/)
  assert.match(sql, /dispatched_count/)
})

test("23. Obras Ops 1.0 + hotfix sin regresión (archivos intactos + create status)", () => {
  const ops10 = readFileSync(OPS_1_0_PATH, "utf8")
  const hotfix = readFileSync(HOTFIX_PATH, "utf8")

  assert.match(ops10, /start_project_operational_dispatch/)
  assert.doesNotMatch(ops10, /ubicación GPS/)
  assert.match(hotfix, /NEW\.status := 'asignada'::public\.task_status/)
  assert.equal(resolveProjectTaskCreateStatus("active"), "asignada")
  assert.equal(resolveProjectTaskCreateStatus("planned"), "programada")
})

test("24. execution_order sin regresión (obra tasks sin planning side-effects)", () => {
  assert.equal(
    shouldApplyPlanningQueueSideEffectsForTask({ projectId: "proj-1" }),
    false
  )
  assert.equal(
    shouldApplyPlanningQueueSideEffectsForTask({ projectId: null }),
    true
  )

  const sql = readFileSync(MIGRATION_PATH, "utf8")
  assert.match(sql, /execution_order = NULL/)
})

test("25. Field Agent visibility sin regresión", () => {
  const today = "2026-07-11"
  assert.equal(
    isFieldAgentAgendaTaskVisible(
      { status: "asignada", dueDate: today },
      today
    ),
    true
  )
  assert.equal(
    isFieldAgentAgendaTaskVisible(
      { status: "programada", dueDate: today },
      today
    ),
    false
  )
})

test("26. multi-tenant: fetch exige company_id + deleted_at en migración/resolución", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8")
  assert.match(sql, /p\.company_id = p_company_id/)
  assert.match(sql, /p\.deleted_at IS NULL/)
  assert.match(sql, /GRANT EXECUTE[\s\S]*TO service_role/)
  assert.doesNotMatch(sql, /GRANT EXECUTE[\s\S]*TO authenticated/)
  assert.doesNotMatch(sql, /CREATE POLICY/)
})

test("27. demo read-only intacto en RPC", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8")
  assert.match(sql, /auth_is_demo_platform_read_only/)
  assert.match(sql, /solo lectura/)
})

test("migración: columnas + constraints de paridad y rango", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8")
  assert.match(sql, /ADD COLUMN IF NOT EXISTS latitude numeric\(10, 7\)/)
  assert.match(sql, /ADD COLUMN IF NOT EXISTS longitude numeric\(10, 7\)/)
  assert.match(sql, /projects_gps_pair_check/)
  assert.match(sql, /projects_latitude_range_check/)
  assert.match(sql, /projects_longitude_range_check/)
  assert.match(sql, /latitude >= -90 AND latitude <= 90/)
  assert.match(sql, /longitude >= -180 AND longitude <= 180/)
  assert.match(
    sql,
    /\(latitude IS NULL AND longitude IS NULL\)\s+OR \(latitude IS NOT NULL AND longitude IS NOT NULL\)/
  )
})

test("mapper histórico: latitude/longitude null compatibles", () => {
  const project = mapProjectRowToProject(baseRow())
  assert.equal(project.latitude, null)
  assert.equal(project.longitude, null)
})
