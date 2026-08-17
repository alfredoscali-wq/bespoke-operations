/**
 * HOTFIX — crear OT en Obra active (nace programada, no asignada).
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { isFieldAgentAgendaTaskVisible } from "../lib/mobile/v1/agenda/agenda-task-visibility.ts"
import { validateObraTaskInsertIntegrity } from "../lib/projects/obra-task-insert-integrity.ts"
import {
  resolveProjectTaskCreateStatus,
  shouldApplyPlanningQueueSideEffectsForTask,
} from "../lib/projects/project-start-dispatch.ts"
import {
  canReleaseProjectTaskToField,
  releaseProjectTaskToField,
} from "../lib/projects/project-task-field-release.ts"
import { getInitialTaskStatus } from "../lib/tasks/task-status-workflow.ts"
import { generateTaskCodeFromOccupied } from "../lib/tasks/utils.ts"

const root = resolve(import.meta.dirname, "..")

function read(relPath) {
  return readFileSync(resolve(root, relPath), "utf8")
}

test("1. OT en Obra planned nace borrador", () => {
  assert.equal(resolveProjectTaskCreateStatus("planned"), "borrador")
  const result = validateObraTaskInsertIntegrity({
    task: {
      companyId: "co",
      projectId: "p1",
      crewId: "c1",
      status: "programada",
    },
    project: { id: "p1", companyId: "co", status: "planned", deletedAt: null },
    crew: { id: "c1", companyId: "co", deletedAt: null },
  })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.status, "borrador")
})

test("3. OT en Obra active nace programada (nunca asignada)", () => {
  assert.equal(resolveProjectTaskCreateStatus("active"), "programada")
  const result = validateObraTaskInsertIntegrity({
    task: {
      companyId: "co",
      projectId: "p1",
      crewId: "c1",
      status: "borrador",
    },
    project: { id: "p1", companyId: "co", status: "active", deletedAt: null },
    crew: { id: "c1", companyId: "co", deletedAt: null },
  })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.status, "programada")
  assert.notEqual(result.ok && result.status, "asignada")
})

test("4-5. Asignar cuadrilla permitido; Enviar a Cuadrilla → asignada", () => {
  const scheduled = {
    projectId: "p1",
    status: "programada",
    crewId: "c1",
    crew: "Cuadrilla 1",
  }
  assert.equal(canReleaseProjectTaskToField(scheduled), true)
  const released = releaseProjectTaskToField(scheduled)
  assert.equal(released.ok, true)
  if (released.ok) assert.equal(released.status, "asignada")
})

test("6. Field Agent: programada no; asignada sí según fecha", () => {
  const today = "2026-08-17"
  assert.equal(
    isFieldAgentAgendaTaskVisible(
      {
        status: "programada",
        startDate: today,
        dueDate: today,
        projectId: "p1",
        crewId: "c1",
      },
      today
    ),
    false
  )
  assert.equal(
    isFieldAgentAgendaTaskVisible(
      {
        status: "asignada",
        startDate: today,
        dueDate: today,
        projectId: "p1",
        crewId: "c1",
      },
      today
    ),
    true
  )
  assert.equal(
    isFieldAgentAgendaTaskVisible(
      {
        status: "asignada",
        startDate: "2026-08-20",
        dueDate: "2026-08-22",
        projectId: "p1",
        crewId: "c1",
      },
      today
    ),
    false
  )
})

test("7-8. Segunda OT en la misma Obra active no exige re-iniciar", () => {
  const first = validateObraTaskInsertIntegrity({
    task: {
      companyId: "co",
      projectId: "p1",
      crewId: "c1",
      status: "programada",
    },
    project: { id: "p1", companyId: "co", status: "active", deletedAt: null },
    crew: { id: "c1", companyId: "co", deletedAt: null },
  })
  const second = validateObraTaskInsertIntegrity({
    task: {
      companyId: "co",
      projectId: "p1",
      crewId: "c1",
      status: "programada",
    },
    project: { id: "p1", companyId: "co", status: "active", deletedAt: null },
    crew: { id: "c1", companyId: "co", deletedAt: null },
  })
  assert.equal(first.ok && first.status, "programada")
  assert.equal(second.ok && second.status, "programada")

  const createHook = read(
    "components/tareas/tasks-provider/hooks/use-tasks-create.ts"
  )
  assert.doesNotMatch(createHook, /start_project_operational_dispatch/)
  assert.doesNotMatch(createHook, /startProject/)
  const tasksTab = read("components/obras/project-tabs/tasks-tab.tsx")
  assert.doesNotMatch(tasksTab, /startProject/)
  assert.match(tasksTab, /resolveProjectTaskCreateStatus\(project\.status\)/)
})

test("9. OT operativa sin project_id sigue naciendo programada", () => {
  assert.equal(getInitialTaskStatus({ crewId: "c1", crew: "A" }), "programada")
  const result = validateObraTaskInsertIntegrity({
    task: {
      companyId: "co",
      projectId: null,
      crewId: "c1",
      status: "programada",
    },
  })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.status, "programada")

  const assignedNormal = validateObraTaskInsertIntegrity({
    task: {
      companyId: "co",
      projectId: null,
      crewId: "c1",
      status: "asignada",
    },
  })
  assert.equal(assignedNormal.ok, false)
})

test("DB trigger OPS 2.0: active → programada; no fuerza asignada", () => {
  const sql = read(
    "supabase/migrations/20261124000200_obras_ops_2_0_fase1_planning.sql"
  )
  assert.match(sql, /v_project_status = 'active'::public\.project_status/)
  assert.match(sql, /NEW\.status := 'programada'::public\.task_status/)
  assert.doesNotMatch(
    sql,
    /NEW\.status := 'asignada'::public\.task_status/
  )
})

test("create path: integrity + occupied codes + error real", () => {
  const queries = read("lib/supabase/tasks.queries.ts")
  assert.match(queries, /validateObraTaskInsertIntegrity/)
  assert.match(queries, /insertPayload = \{\s*[\s\S]*status: integrity\.status/)

  const createHook = read(
    "components/tareas/tasks-provider/hooks/use-tasks-create.ts"
  )
  assert.match(createHook, /listOccupiedTaskCodesByPrefix/)
  assert.match(createHook, /generateTaskCodeFromOccupied/)
  assert.match(createHook, /result\.error\?\.message/)
  assert.doesNotMatch(createHook, /console\.log\("BEFORE INSERT"/)
  assert.equal(
    shouldApplyPlanningQueueSideEffectsForTask({
      projectId: "p1",
      status: "programada",
    }),
    false
  )
})

test("código de Obra no reutiliza un código ocupado/borrado", () => {
  assert.equal(
    generateTaskCodeFromOccupied("OB-001", ["TSK-OB001-001", "TSK-OB001-002"]),
    "TSK-OB001-003"
  )
  assert.equal(
    generateTaskCodeFromOccupied("OB-001", ["TSK-OB001-001", "TSK-OB001-003"]),
    "TSK-OB001-004"
  )
})
