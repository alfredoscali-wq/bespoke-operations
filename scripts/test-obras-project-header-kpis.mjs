/**
 * Obra header KPIs: project-scoped OT list, not fetchTasks() / global 1000.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import { buildProjectHeaderKpis } from "../lib/projects/project-header-kpis.ts"
import { matchesProjectWorkOrderListQuery } from "../lib/tasks/task-list-scope.ts"
import { ACTIVE_TASK_STATUSES, FINAL_TASK_STATUSES } from "../lib/tasks/status-groups.ts"
import { isPendingClosureStatus } from "../lib/tasks/task-status-workflow.ts"

const root = resolve(import.meta.dirname, "..")

function read(rel) {
  return readFileSync(resolve(root, rel), "utf8")
}

const COMPANY_ID = "00000000-0000-4000-8000-000000000002"
const OTHER_COMPANY_ID = "00000000-0000-4000-8000-000000000099"
const DOROTEA_PROJECT_ID = "9d66e4ed-6625-4a76-9854-471074232ddf"
const OTHER_PROJECT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

const project = {
  id: DOROTEA_PROJECT_ID,
  code: "FO-DOR",
  progress: 0,
}

function makeTask(overrides = {}) {
  return {
    id: overrides.id ?? "ot-1",
    code: overrides.code ?? "TSK-1",
    title: overrides.title ?? "OT",
    description: "",
    projectId: overrides.projectId ?? DOROTEA_PROJECT_ID,
    projectCode: "FO-DOR",
    projectName: "Certificacion Dorotea",
    type: "fiber",
    status: overrides.status ?? "asignada",
    priority: "media",
    supervisor: "Supervisor",
    crewId: "crew-1",
    crew: "Cuadrilla",
    startDate: "2026-09-23",
    dueDate: overrides.dueDate ?? "2026-09-23",
    estimatedDuration: "120",
    checklist: [],
    progress: 0,
    companyId: overrides.companyId ?? COMPANY_ID,
    deletedAt: overrides.deletedAt ?? null,
    ...overrides,
  }
}

function makeFodorLiveTasks() {
  const pending = Array.from({ length: 22 }, (_, index) =>
    makeTask({
      id: `fod-pc-${index + 1}`,
      code: `TSK-FODOR-${String(index + 1).padStart(3, "0")}`,
      status: "pendiente-cierre",
    })
  )
  const assigned = [
    makeTask({
      id: "fod-asig-1",
      code: "TSK-FODOR-023",
      status: "asignada",
    }),
    makeTask({
      id: "fod-asig-2",
      code: "TSK-FODOR-024",
      status: "asignada",
    }),
  ]
  return [...pending, ...assigned]
}

function firstFetchTasksPage(all) {
  return all.slice(0, 1000)
}

function selectProjectLiveTasks(rows, companyId, projectId) {
  return rows.filter((row) =>
    matchesProjectWorkOrderListQuery(row, companyId, projectId)
  )
}

test("A/B. OT fuera del rank 1000 global siguen contando en el encabezado", () => {
  const earlier = Array.from({ length: 1031 }, (_, index) =>
    makeTask({
      id: `earlier-${index}`,
      code: `TSK-OLD-${index}`,
      projectId: null,
      projectCode: "OT",
      dueDate: "2026-07-13",
      status: "finalizada",
    })
  )
  const fod = makeFodorLiveTasks()
  const universe = [...earlier, ...fod]
  assert.ok(universe.length > 1000)

  const providerTasks = firstFetchTasksPage(universe)
  assert.equal(providerTasks.length, 1000)
  assert.equal(
    providerTasks.filter((task) => task.projectId === DOROTEA_PROJECT_ID).length,
    0
  )
  assert.deepEqual(buildProjectHeaderKpis(project, providerTasks), {
    total: 0,
    active: 0,
    pendingClosure: 0,
    completed: 0,
  })

  const scoped = selectProjectLiveTasks(universe, COMPANY_ID, DOROTEA_PROJECT_ID)
  assert.equal(scoped.length, 24)
  assert.deepEqual(buildProjectHeaderKpis(project, scoped), {
    total: 24,
    active: 24,
    pendingClosure: 22,
    completed: 0,
  })
})

test("C. company_id aísla el resultado", () => {
  const own = makeFodorLiveTasks()
  const foreign = makeFodorLiveTasks().map((task, index) =>
    makeTask({
      ...task,
      id: `foreign-${index}`,
      companyId: OTHER_COMPANY_ID,
    })
  )
  const otherProject = [
    makeTask({
      id: "other-project",
      projectId: OTHER_PROJECT_ID,
      status: "pendiente-cierre",
    }),
  ]

  const scoped = selectProjectLiveTasks(
    [...own, ...foreign, ...otherProject],
    COMPANY_ID,
    DOROTEA_PROJECT_ID
  )
  assert.equal(scoped.length, 24)
  assert.equal(
    scoped.every((task) => task.companyId === COMPANY_ID),
    true
  )
  assert.deepEqual(buildProjectHeaderKpis(project, scoped), {
    total: 24,
    active: 24,
    pendingClosure: 22,
    completed: 0,
  })
})

test("D. deleted_at IS NULL excluye OT eliminadas", () => {
  const live = makeFodorLiveTasks()
  const deleted = [
    makeTask({
      id: "deleted-1",
      status: "pendiente-cierre",
      deletedAt: "2026-09-23T18:00:00Z",
    }),
    makeTask({
      id: "deleted-2",
      status: "asignada",
      deletedAt: "2026-09-23T18:00:00Z",
    }),
  ]
  const scoped = selectProjectLiveTasks(
    [...live, ...deleted],
    COMPANY_ID,
    DOROTEA_PROJECT_ID
  )
  assert.equal(scoped.length, 24)
  assert.deepEqual(buildProjectHeaderKpis(project, scoped), {
    total: 24,
    active: 24,
    pendingClosure: 22,
    completed: 0,
  })
})

test("E. Semántica actual de estados del encabezado", () => {
  assert.deepEqual(ACTIVE_TASK_STATUSES, [
    "borrador",
    "programada",
    "asignada",
    "vencida",
    "en-curso",
    "incidencia",
    "pendiente-cierre",
    "en-aprobacion",
  ])
  assert.equal(isPendingClosureStatus("pendiente-cierre"), true)
  assert.equal(isPendingClosureStatus("en-aprobacion"), true)
  assert.deepEqual(FINAL_TASK_STATUSES, ["finalizada", "cancelada"])

  const mixed = [
    makeTask({ id: "a", status: "borrador" }),
    makeTask({ id: "b", status: "programada" }),
    makeTask({ id: "c", status: "asignada" }),
    makeTask({ id: "d", status: "vencida" }),
    makeTask({ id: "e", status: "en-curso" }),
    makeTask({ id: "f", status: "incidencia" }),
    makeTask({ id: "g", status: "pendiente-cierre" }),
    makeTask({ id: "h", status: "en-aprobacion" }),
    makeTask({ id: "i", status: "finalizada" }),
    makeTask({ id: "j", status: "cancelada" }),
    makeTask({ id: "k", status: "cerrada" }),
  ]
  const kpis = buildProjectHeaderKpis(project, mixed)
  assert.equal(kpis.total, 11)
  assert.equal(kpis.active, 8)
  assert.equal(kpis.pendingClosure, 2)
  assert.equal(kpis.completed, 2)
})

test("FO-DOR: 22 pendiente-cierre + 2 asignada", () => {
  const kpis = buildProjectHeaderKpis(project, makeFodorLiveTasks())
  assert.equal(kpis.total, 24)
  assert.equal(kpis.active, 24)
  assert.equal(kpis.pendingClosure, 22)
  assert.equal(kpis.completed, 0)
})

test("encabezado no usa fetchTasks ni el array global de TasksProvider", () => {
  const header = read("components/obras/project-detail-operational-header.tsx")
  assert.match(header, /buildProjectHeaderKpis\(project, projectTasks\)/)
  assert.doesNotMatch(header, /useTasks\(/)
  assert.doesNotMatch(header, /fetchTasks\(/)
  assert.doesNotMatch(header, /listTasks\(/)

  const view = read("components/obras/project-detail-view.tsx")
  assert.match(view, /useProjectWorkOrderTasks\(project\.id\)/)
  assert.match(view, /projectTasks=\{projectTasks\}/)
  assert.doesNotMatch(view, /tasks=\{tasks\}/)

  const hook = read("components/obras/use-project-work-order-tasks.ts")
  assert.match(hook, /listProjectWorkOrderTasks\(companyId, projectId\)/)
  assert.doesNotMatch(hook, /fetchTasks\(/)
  assert.doesNotMatch(hook, /listTasks\(/)
})
