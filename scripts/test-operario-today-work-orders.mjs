import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  getOperarioTodayTasks,
  isOperarioTodayTask,
  isOperarioWorkerTaskAccessible,
} from "../lib/data/operario.ts"
import {
  OPERARIO_TODAY_WORK_ORDER_LIST_STATUSES,
  matchesOperarioTodayWorkOrderListQuery,
  matchesOperarioWebWorkOrderByIdQuery,
  selectOperarioTodayWorkOrderListRows,
} from "../lib/tasks/task-list-scope.ts"

const root = resolve(import.meta.dirname, "..")
const COMPANY = "00000000-0000-4000-8000-000000000002"
const OTHER_COMPANY = "00000000-0000-4000-8000-000000000001"
const TODAY = "2026-09-17"
const CREW = { id: "crew-a", name: "Cuadrilla A" }
const OTHER_CREW = { id: "crew-b", name: "Cuadrilla B" }

function read(rel) {
  return readFileSync(resolve(root, rel), "utf8")
}

function todayQuerySource() {
  const queries = read("lib/supabase/tasks.queries.ts")
  return queries.slice(
    queries.indexOf("export async function fetchOperarioTodayWorkOrderListTasks("),
    queries.indexOf("export async function fetchOperarioWebWorkOrderById(")
  )
}

function byIdQuerySource() {
  const queries = read("lib/supabase/tasks.queries.ts")
  return queries.slice(
    queries.indexOf("export async function fetchOperarioWebWorkOrderById("),
    queries.indexOf("export async function fetchTaskById(")
  )
}

function selectByFetchTasksCap(rows, maxRows = 1000) {
  return [...rows]
    .sort(
      (left, right) =>
        left.dueDate.localeCompare(right.dueDate) ||
        (left.code ?? "").localeCompare(right.code ?? "")
    )
    .slice(0, maxRows)
}

function row(overrides = {}) {
  return {
    id: overrides.id ?? overrides.code ?? "ot",
    code: overrides.code ?? "OT-1",
    status: overrides.status ?? "asignada",
    projectId: overrides.projectId ?? null,
    deletedAt: overrides.deletedAt ?? null,
    companyId: overrides.companyId ?? COMPANY,
    dueDate: overrides.dueDate ?? TODAY,
    startDate: overrides.startDate ?? TODAY,
    crewId: overrides.crewId ?? CREW.id,
    crew: overrides.crew ?? CREW.name,
    title: overrides.title ?? overrides.code ?? "OT-1",
  }
}

function task(overrides = {}) {
  return {
    id: "ot-1",
    code: "OT-1",
    title: "OT",
    description: "",
    projectCode: "",
    projectName: "",
    type: "fiber",
    status: "asignada",
    priority: "media",
    supervisor: "",
    crew: CREW.name,
    crewId: CREW.id,
    startDate: TODAY,
    dueDate: TODAY,
    estimatedDuration: "",
    checklist: [],
    progress: 0,
    ...overrides,
  }
}

test("/operario ya no utiliza fetchTasks() y usa el scope operarioToday", () => {
  const shell = read("components/operario/operario-shell.tsx")
  const load = read("components/tareas/tasks-provider/hooks/use-tasks-load.ts")
  const browser = read("lib/supabase/tasks.browser.ts")
  const home = read("components/operario/operario-home-screen.tsx")
  const perfil = read("components/operario/operario-profile-screen.tsx")
  const historialLayout = read("app/operario/tareas/layout.tsx")
  const historialScreen = read("components/operario/operario-tasks-screen.tsx")

  assert.match(shell, /listScope="operarioToday"/)
  assert.equal(shell.includes("fetchTasks("), false)
  assert.equal(shell.includes("listTasks("), false)
  assert.match(load, /"operarioToday"/)
  assert.match(load, /listOperarioTodayWorkOrderTasks/)
  assert.match(browser, /fetchOperarioTodayWorkOrderListTasks/)
  assert.match(home, /getOperarioTodayTasks/)
  assert.equal(perfil.includes("useTasks"), false)
  assert.match(historialLayout, /<TasksProvider>/)
  assert.equal(historialLayout.includes("operarioToday"), false)
  assert.match(historialScreen, /groupOperarioHistoryTasks/)
})

test("query Operario Hoy tiene company_id, deleted_at IS NULL y estados correctos", () => {
  const todayBlock = todayQuerySource()

  assert.match(todayBlock, /\.eq\("company_id", companyId\)/)
  assert.match(todayBlock, /\.is\("deleted_at", null\)/)
  assert.match(
    todayBlock,
    /\.in\("status", \[\.\.\.OPERARIO_TODAY_WORK_ORDER_LIST_STATUSES\]\)/
  )
  assert.match(todayBlock, /applyOperarioWebCrewFilter/)
  assert.equal(todayBlock.includes("fetchTasks("), false)
  assert.equal(todayBlock.includes('.is("project_id", null)'), false)
  assert.equal(todayBlock.includes("start_date"), false)
  assert.equal(todayBlock.includes("due_date"), false)
  assert.equal(todayBlock.includes("agenda"), false)
  assert.equal(todayBlock.includes("programada"), false)
})

test("query incluye estados de Hoy y excluye programada / históricas / borrador", () => {
  assert.deepEqual(OPERARIO_TODAY_WORK_ORDER_LIST_STATUSES, [
    "asignada",
    "en-curso",
    "vencida",
    "incidencia",
    "pendiente-cierre",
    "en-aprobacion",
  ])
  assert.equal(OPERARIO_TODAY_WORK_ORDER_LIST_STATUSES.includes("programada"), false)
  assert.equal(OPERARIO_TODAY_WORK_ORDER_LIST_STATUSES.includes("finalizada"), false)
  assert.equal(OPERARIO_TODAY_WORK_ORDER_LIST_STATUSES.includes("cerrada"), false)
  assert.equal(OPERARIO_TODAY_WORK_ORDER_LIST_STATUSES.includes("cancelada"), false)
  assert.equal(OPERARIO_TODAY_WORK_ORDER_LIST_STATUSES.includes("borrador"), false)

  for (const status of OPERARIO_TODAY_WORK_ORDER_LIST_STATUSES) {
    assert.equal(
      matchesOperarioTodayWorkOrderListQuery(row({ status }), COMPANY, CREW),
      true,
      status
    )
  }

  assert.equal(
    matchesOperarioTodayWorkOrderListQuery(
      row({ status: "programada" }),
      COMPANY,
      CREW
    ),
    false
  )
  assert.equal(
    matchesOperarioTodayWorkOrderListQuery(
      row({ status: "finalizada" }),
      COMPANY,
      CREW
    ),
    false
  )
  assert.equal(
    matchesOperarioTodayWorkOrderListQuery(
      row({ status: "cancelada" }),
      COMPANY,
      CREW
    ),
    false
  )
  assert.equal(
    matchesOperarioTodayWorkOrderListQuery(
      row({ status: "borrador" }),
      COMPANY,
      CREW
    ),
    false
  )
})

test("la cuadrilla se aplica; OT de otra cuadrilla u otro tenant no aparece", () => {
  assert.equal(
    matchesOperarioTodayWorkOrderListQuery(row(), COMPANY, CREW),
    true
  )
  assert.equal(
    matchesOperarioTodayWorkOrderListQuery(
      row({ crewId: OTHER_CREW.id, crew: OTHER_CREW.name }),
      COMPANY,
      CREW
    ),
    false
  )
  assert.equal(
    matchesOperarioTodayWorkOrderListQuery(
      row({ companyId: OTHER_COMPANY }),
      COMPANY,
      CREW
    ),
    false
  )
  assert.equal(
    matchesOperarioTodayWorkOrderListQuery(
      row({ deletedAt: "2026-01-01T00:00:00Z" }),
      COMPANY,
      CREW
    ),
    false
  )
})

test("OT de Obra puede aparecer si corresponde a la cuadrilla", () => {
  assert.equal(
    matchesOperarioTodayWorkOrderListQuery(
      row({ projectId: "obra-1", status: "en-curso" }),
      COMPANY,
      CREW
    ),
    true
  )
})

test("OT válida después de la fila 1000 llega al Operario; históricas no consumen el cupo", () => {
  const historical = Array.from({ length: 1100 }, (_, index) =>
    row({
      id: `old-${index}`,
      code: `TSK-OLD-${String(index).padStart(4, "0")}`,
      status: "finalizada",
      dueDate: "2026-01-01",
    })
  )
  const live = row({
    id: "live-after-1000",
    code: "TSK-OT-LIVE",
    status: "asignada",
    dueDate: TODAY,
  })
  const otherCrewLive = row({
    id: "other-crew-live",
    code: "TSK-OT-OTHER",
    status: "en-curso",
    crewId: OTHER_CREW.id,
    crew: OTHER_CREW.name,
  })
  const otherTenantLive = row({
    id: "other-tenant-live",
    code: "TSK-OT-TENANT",
    status: "en-curso",
    companyId: OTHER_COMPANY,
  })
  const all = [...historical, live, otherCrewLive, otherTenantLive]

  const unfilteredCap = selectByFetchTasksCap(all)
  const unfilteredIds = new Set(unfilteredCap.map((item) => item.id))
  assert.equal(unfilteredIds.has("live-after-1000"), false)

  const selected = selectOperarioTodayWorkOrderListRows(all, COMPANY, CREW, 1000)
  const selectedIds = selected.map((item) => item.id)
  assert.ok(selectedIds.includes("live-after-1000"))
  assert.equal(selectedIds.includes("other-crew-live"), false)
  assert.equal(selectedIds.includes("other-tenant-live"), false)
  assert.equal(
    selected.some((item) => item.code.startsWith("TSK-OLD-")),
    false
  )
})

test("lib/data/operario.ts sigue determinando la visibilidad final de Hoy", () => {
  const home = read("components/operario/operario-home-screen.tsx")
  const operarioData = read("lib/data/operario.ts")

  assert.match(home, /getOperarioTodayTasks/)
  assert.match(operarioData, /isOperarioScheduledTaskVisibleToday/)
  assert.match(operarioData, /compareDateOnly\(task\.dueDate, referenceDate\) <= 0/)
  assert.equal(operarioData.includes("startDate"), false)
  assert.equal(operarioData.includes("start_date"), false)

  const futureAssigned = task({
    id: "future-assigned",
    status: "asignada",
    dueDate: "2026-12-01",
  })
  const todayAssigned = task({ id: "today-assigned", status: "asignada" })
  const inProgressFuture = task({
    id: "in-progress",
    status: "en-curso",
    dueDate: "2026-12-01",
  })
  const programmed = task({ id: "programmed", status: "programada" })

  assert.equal(
    matchesOperarioTodayWorkOrderListQuery(futureAssigned, COMPANY, CREW),
    true
  )
  assert.equal(isOperarioTodayTask(futureAssigned, TODAY), false)
  assert.equal(isOperarioTodayTask(todayAssigned, TODAY), true)
  assert.equal(isOperarioTodayTask(inProgressFuture, TODAY), true)
  assert.equal(isOperarioTodayTask(programmed, TODAY), false)

  const visible = getOperarioTodayTasks(
    [futureAssigned, todayAssigned, inProgressFuture, programmed],
    CREW,
    TODAY
  )
  const visibleIds = visible.map((item) => item.id)
  assert.deepEqual(visibleIds.sort(), ["in-progress", "today-assigned"].sort())
})

test("/operario/tarea/[id] no depende del array global de 1000", () => {
  const detail = read("components/operario/operario-task-detail-screen.tsx")
  const byIdBlock = byIdQuerySource()
  const load = read("components/tareas/tasks-provider/hooks/use-tasks-load.ts")

  assert.match(detail, /getOperarioWebWorkOrderById/)
  assert.match(detail, /isOperarioWorkerTaskAccessible/)
  assert.match(detail, /mergeFetchedTask/)
  assert.equal(detail.includes("fetchTasks("), false)
  assert.match(byIdBlock, /\.eq\("company_id", companyId\)/)
  assert.match(byIdBlock, /\.eq\("id", taskId\)/)
  assert.match(byIdBlock, /\.is\("deleted_at", null\)/)
  assert.match(byIdBlock, /applyOperarioWebCrewFilter/)
  assert.equal(byIdBlock.includes("fetchTasks("), false)
  assert.equal(byIdBlock.includes('.in("status"'), false)
  assert.match(load, /mergeFetchedTask/)
})

test("una OT válida fuera del límite puede abrirse por ID; otra empresa o soft-deleted no", () => {
  const live = row({
    id: "live-after-1000",
    code: "TSK-OT-LIVE",
    status: "asignada",
    dueDate: TODAY,
  })
  const history = row({
    id: "history-finalizada",
    status: "finalizada",
    dueDate: "2026-01-01",
  })
  const otherTenant = row({
    id: "other-tenant",
    companyId: OTHER_COMPANY,
    status: "en-curso",
  })
  const deleted = row({
    id: "deleted-ot",
    status: "en-curso",
    deletedAt: "2026-01-01T00:00:00Z",
  })
  const otherCrew = row({
    id: "other-crew",
    crewId: OTHER_CREW.id,
    crew: OTHER_CREW.name,
    status: "en-curso",
  })

  assert.equal(
    matchesOperarioWebWorkOrderByIdQuery(
      live,
      COMPANY,
      "live-after-1000",
      CREW
    ),
    true
  )
  assert.equal(
    matchesOperarioWebWorkOrderByIdQuery(
      history,
      COMPANY,
      "history-finalizada",
      CREW
    ),
    true
  )
  assert.equal(
    isOperarioWorkerTaskAccessible(task(history), CREW, TODAY),
    true
  )
  assert.equal(
    matchesOperarioWebWorkOrderByIdQuery(
      otherTenant,
      COMPANY,
      "other-tenant",
      CREW
    ),
    false
  )
  assert.equal(
    matchesOperarioWebWorkOrderByIdQuery(deleted, COMPANY, "deleted-ot", CREW),
    false
  )
  assert.equal(
    matchesOperarioWebWorkOrderByIdQuery(otherCrew, COMPANY, "other-crew", CREW),
    false
  )
  assert.equal(
    isOperarioWorkerTaskAccessible(task(otherCrew), CREW, TODAY),
    false
  )
})
