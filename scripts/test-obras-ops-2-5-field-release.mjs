/**
 * OPS 2.5 — release / return Obra OTs to Field Agent.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  canReleaseProjectTaskToField,
  canReturnProjectTaskToPlanning,
  prepareProjectTaskFieldRelease,
  PROJECT_TASK_NOT_FOUND_MESSAGE,
  releaseProjectTaskToField,
  resolveProjectTaskFieldDispatchBadge,
  returnProjectTaskToPlanning,
} from "../lib/projects/project-task-field-release.ts"
import { resolveProjectTaskRowActions } from "../lib/projects/project-task-row-actions.ts"
import { getTransitionForAction } from "../lib/tasks/task-status-workflow.ts"
import {
  isFieldAgentAgendaTaskVisible,
  isOperationalDateRangeActive,
} from "../lib/mobile/v1/agenda/agenda-task-visibility.ts"
import { shouldApplyPlanningQueueSideEffectsForTask } from "../lib/projects/project-start-dispatch.ts"

const base = {
  projectId: "project-1",
  crewId: "crew-1",
  crew: "Cuadrilla A",
}

test("OPS 2.5: release programada → asignada", () => {
  const result = releaseProjectTaskToField({
    ...base,
    status: "programada",
  })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.status, "asignada")
  assert.equal(
    canReleaseProjectTaskToField({ ...base, status: "programada" }),
    true
  )
  assert.equal(
    canReleaseProjectTaskToField({ ...base, status: "asignada" }),
    false
  )
  assert.equal(
    releaseProjectTaskToField({
      projectId: "p1",
      status: "programada",
      crewId: undefined,
      crew: "",
    }).ok,
    false
  )
})

test("OPS 2.5: return solo desde asignada", () => {
  const ok = returnProjectTaskToPlanning({
    projectId: "p1",
    status: "asignada",
  })
  assert.equal(ok.ok, true)
  if (ok.ok) assert.equal(ok.status, "programada")

  assert.equal(
    returnProjectTaskToPlanning({ projectId: "p1", status: "en-curso" }).ok,
    false
  )
  assert.equal(
    returnProjectTaskToPlanning({
      projectId: "p1",
      status: "pendiente-cierre",
    }).ok,
    false
  )
  assert.equal(
    returnProjectTaskToPlanning({ projectId: "p1", status: "finalizada" }).ok,
    false
  )
  assert.equal(
    returnProjectTaskToPlanning({ projectId: "p1", status: "programada" }).ok,
    false
  )
  assert.equal(canReturnProjectTaskToPlanning({ ...base, status: "asignada" }), true)
})

test("OPS 2.5: workflow actions", () => {
  assert.deepEqual(getTransitionForAction("release-obra-to-field"), {
    from: ["programada"],
    to: "asignada",
  })
  assert.deepEqual(getTransitionForAction("return-obra-from-field"), {
    from: ["asignada"],
    to: "programada",
  })
})

test("OPS 2.5: badges y row actions", () => {
  assert.equal(
    resolveProjectTaskFieldDispatchBadge({
      projectId: "p1",
      status: "programada",
    }),
    "Pendiente de envío"
  )
  assert.equal(
    resolveProjectTaskFieldDispatchBadge({
      projectId: "p1",
      status: "asignada",
    }),
    "Enviada a campo"
  )
  assert.equal(
    resolveProjectTaskFieldDispatchBadge({
      projectId: "p1",
      status: "en-curso",
    }),
    null
  )

  const programmed = resolveProjectTaskRowActions({
    ...base,
    status: "programada",
    progress: 0,
    completedAt: null,
    closedAt: null,
    operationalSteps: [],
  })
  assert.equal(programmed.showReleaseToField, true)
  assert.equal(programmed.showReturnFromField, false)

  const assigned = resolveProjectTaskRowActions({
    ...base,
    status: "asignada",
    progress: 0,
    completedAt: null,
    closedAt: null,
    operationalSteps: [],
  })
  assert.equal(assigned.showReleaseToField, false)
  assert.equal(assigned.showReturnFromField, true)
})

test("OPS 2.5: FA no muestra Obra programada", () => {
  const today = "2026-08-09"
  assert.equal(
    isFieldAgentAgendaTaskVisible(
      {
        status: "programada",
        startDate: today,
        dueDate: "2026-08-20",
        projectId: "p1",
        crewId: "crew-1",
      },
      today
    ),
    false
  )
})

test("OPS 2.5: FA muestra asignada solo desde start_date", () => {
  assert.equal(
    isOperationalDateRangeActive(
      { startDate: "2026-08-20", dueDate: "2026-08-25" },
      "2026-08-18"
    ),
    false
  )
  assert.equal(
    isOperationalDateRangeActive(
      { startDate: "2026-08-20", dueDate: "2026-08-25" },
      "2026-08-19"
    ),
    false
  )
  assert.equal(
    isOperationalDateRangeActive(
      { startDate: "2026-08-20", dueDate: "2026-08-25" },
      "2026-08-20"
    ),
    true
  )

  assert.equal(
    isFieldAgentAgendaTaskVisible(
      {
        status: "asignada",
        startDate: "2026-08-20",
        dueDate: "2026-08-25",
        projectId: "p1",
        crewId: "crew-1",
      },
      "2026-08-19"
    ),
    false
  )
  assert.equal(
    isFieldAgentAgendaTaskVisible(
      {
        status: "asignada",
        startDate: "2026-08-20",
        dueDate: "2026-08-25",
        projectId: "p1",
        crewId: "crew-1",
      },
      "2026-08-20"
    ),
    true
  )
})

test("OPS 2.5: release no implica side-effects de ruta", () => {
  assert.equal(
    shouldApplyPlanningQueueSideEffectsForTask({
      projectId: "p1",
      status: "asignada",
    }),
    false
  )
})

const COMPANY_ID = "00000000-0000-4000-8000-000000000002"
const DOROTEA_PROJECT_ID = "9d66e4ed-6625-4a76-9854-471074232ddf"
const FODOR_016_ID = "25fa481e-f9ec-446f-819d-6a9375d162ae"
const FODOR_018_ID = "5826e4e2-5b51-450b-b868-b1914bd7c669"
const CREW_ID = "d1a72a16-2cef-4ae4-bedc-7ef818ddb238"

function makeObraTask(overrides = {}) {
  return {
    id: overrides.id ?? "ot-1",
    code: overrides.code ?? "TSK-TEST-001",
    title: overrides.title ?? "NAP",
    description: "",
    projectId: DOROTEA_PROJECT_ID,
    projectCode: "FO-DOR",
    projectName: "Certificacion Dorotea",
    type: "fiber",
    status: "programada",
    priority: "media",
    supervisor: "Supervisor",
    crewId: CREW_ID,
    crew: "Cuadrilla 3",
    startDate: "2026-09-23",
    dueDate: "2026-09-23",
    estimatedDuration: "120",
    checklist: [],
    progress: 0,
    ...overrides,
  }
}

function notFoundLookup() {
  return {
    data: null,
    error: {
      code: "NOT_FOUND",
      message: "Orden de trabajo no encontrada.",
    },
  }
}

function liveLookupFrom(rows) {
  const byId = new Map(rows.map((task) => [task.id, task]))
  return async (companyId, taskId) => {
    assert.equal(companyId, COMPANY_ID)
    const task = byId.get(taskId)
    if (!task) return notFoundLookup()
    return { data: task, error: null }
  }
}

test("OPS 2.5: OT dentro de las primeras 1000 se puede enviar", async () => {
  const inCap = makeObraTask({
    id: "rank-10",
    code: "TSK-FODOR-002",
  })
  const result = await prepareProjectTaskFieldRelease(inCap.id, COMPANY_ID, {
    loadedTask: inCap,
    loadLiveTask: async () => {
      throw new Error("loaded Obra OT must not require a live lookup")
    },
  })
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.status, "asignada")
})

test("OPS 2.5: OT fuera de las primeras 1000 se puede enviar", async () => {
  const ranked = Array.from({ length: 1081 }, (_, index) =>
    makeObraTask({
      id: `rank-${index + 1}`,
      code: `TSK-RANK-${String(index + 1).padStart(4, "0")}`,
    })
  )
  const fod016 = makeObraTask({
    id: FODOR_016_ID,
    code: "TSK-FODOR-016",
    title: "NAP 525",
  })
  const fod018 = makeObraTask({
    id: FODOR_018_ID,
    code: "TSK-FODOR-018",
    title: "NAP 526",
  })
  ranked[1039] = fod016
  ranked[1040] = fod018

  const providerTasks = ranked.slice(0, 1000)
  assert.equal(
    providerTasks.find((item) => item.id === FODOR_016_ID),
    undefined
  )
  assert.equal(
    providerTasks.find((item) => item.id === FODOR_018_ID),
    undefined
  )

  const projectTasks = [fod016, fod018]
  const fromProject = await prepareProjectTaskFieldRelease(
    FODOR_016_ID,
    COMPANY_ID,
    {
      projectTasks,
      loadLiveTask: async () => {
        throw new Error("projectTasks must be enough for visible Obra OTs")
      },
    }
  )
  assert.equal(fromProject.ok, true)

  const fromLive = await prepareProjectTaskFieldRelease(
    FODOR_018_ID,
    COMPANY_ID,
    {
      loadLiveTask: liveLookupFrom(ranked),
    }
  )
  assert.equal(fromLive.ok, true)
})

test("OPS 2.5: OT inexistente sigue dando no encontrada", async () => {
  const result = await prepareProjectTaskFieldRelease(
    "00000000-0000-4000-8000-000000000099",
    COMPANY_ID,
    { loadLiveTask: liveLookupFrom([]) }
  )
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.message, PROJECT_TASK_NOT_FOUND_MESSAGE)
  }
})

test("OPS 2.5: OT eliminada no se puede enviar", async () => {
  const deletedId = "deleted-ot"
  const result = await prepareProjectTaskFieldRelease(deletedId, COMPANY_ID, {
    loadLiveTask: async (_companyId, taskId) => {
      assert.equal(taskId, deletedId)
      return notFoundLookup()
    },
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.message, PROJECT_TASK_NOT_FOUND_MESSAGE)
  }
})

test("OPS 2.5: status distinto de programada sigue bloqueado", async () => {
  const assigned = makeObraTask({
    id: FODOR_016_ID,
    code: "TSK-FODOR-016",
    status: "asignada",
  })
  const result = await prepareProjectTaskFieldRelease(assigned.id, COMPANY_ID, {
    loadedTask: assigned,
    loadLiveTask: async () => notFoundLookup(),
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(
      result.message,
      "Solo se puede enviar a la cuadrilla una OT en estado Programada."
    )
  }
})

test("OPS 2.5: OT sin crew sigue bloqueada", async () => {
  const noCrew = makeObraTask({
    id: FODOR_018_ID,
    code: "TSK-FODOR-018",
    crewId: "",
    crew: "",
  })
  const result = await prepareProjectTaskFieldRelease(noCrew.id, COMPANY_ID, {
    loadedTask: noCrew,
    loadLiveTask: async () => notFoundLookup(),
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(
      result.message,
      "Asigne una cuadrilla antes de enviar la OT a campo."
    )
  }
})

test("OPS 2.5: TSK-FODOR-016 y TSK-FODOR-018 se pueden enviar con rank >1000", async () => {
  const fod016 = makeObraTask({
    id: FODOR_016_ID,
    code: "TSK-FODOR-016",
    title: "NAP 525",
  })
  const fod018 = makeObraTask({
    id: FODOR_018_ID,
    code: "TSK-FODOR-018",
    title: "NAP 526",
  })
  const providerTasks = Array.from({ length: 1000 }, (_, index) =>
    makeObraTask({
      id: `cap-${index}`,
      code: `TSK-CAP-${String(index).padStart(4, "0")}`,
    })
  )
  assert.equal(
    Boolean(providerTasks.find((item) => item.id === FODOR_016_ID)),
    false
  )
  assert.equal(
    Boolean(providerTasks.find((item) => item.id === FODOR_018_ID)),
    false
  )

  const first = await prepareProjectTaskFieldRelease(FODOR_016_ID, COMPANY_ID, {
    loadedTask: fod016,
    loadLiveTask: liveLookupFrom([fod016, fod018]),
  })
  const second = await prepareProjectTaskFieldRelease(FODOR_018_ID, COMPANY_ID, {
    projectTasks: [fod016, fod018],
    loadLiveTask: liveLookupFrom([fod016, fod018]),
  })
  assert.equal(first.ok, true)
  assert.equal(second.ok, true)
  if (first.ok) assert.equal(first.task.code, "TSK-FODOR-016")
  if (second.ok) assert.equal(second.task.code, "TSK-FODOR-018")
})

test("OPS 2.5: envío rank >1000 no depende del listado global", async () => {
  let globalListCalls = 0
  async function fetchTasks() {
    globalListCalls += 1
    return Array.from({ length: 1000 }, (_, index) =>
      makeObraTask({ id: `cap-${index}` })
    )
  }

  const fod016 = makeObraTask({
    id: FODOR_016_ID,
    code: "TSK-FODOR-016",
  })
  const result = await prepareProjectTaskFieldRelease(FODOR_016_ID, COMPANY_ID, {
    loadLiveTask: async (companyId, taskId) => {
      assert.equal(globalListCalls, 0)
      assert.equal(taskId, FODOR_016_ID)
      return liveLookupFrom([fod016])(companyId, taskId)
    },
  })

  assert.equal(result.ok, true)
  assert.equal(globalListCalls, 0)
  await fetchTasks()
  assert.equal(globalListCalls, 1)
})

test("OPS 2.5: wiring Enviar a Cuadrilla no usa TasksProvider.find ni listado global", () => {
  const incidents = readFileSync(
    resolve(import.meta.dirname, "../components/tareas/tasks-provider/hooks/use-tasks-incidents.ts"),
    "utf8"
  )
  const releaseStart = incidents.indexOf(
    "const releaseProjectTaskToFieldAction = useCallback"
  )
  const returnStart = incidents.indexOf(
    "const returnProjectTaskFromFieldAction = useCallback"
  )
  const actionsEnd = incidents.lastIndexOf("return {")
  assert.ok(releaseStart > 0 && returnStart > releaseStart)
  const releaseBlock = incidents.slice(releaseStart, returnStart)
  const returnBlock = incidents.slice(returnStart, actionsEnd)

  assert.equal(releaseBlock.includes("tasks.find("), false)
  assert.equal(returnBlock.includes("tasks.find("), false)
  assert.match(releaseBlock, /prepareProjectTaskFieldRelease/)
  assert.match(releaseBlock, /getLiveTaskByCompanyAndId/)
  assert.match(releaseBlock, /existingTask: prepared\.task/)
  assert.match(returnBlock, /prepareProjectTaskFieldReturn/)
  assert.match(returnBlock, /getLiveTaskByCompanyAndId/)
  assert.equal(incidents.includes("fetchTasks("), false)
  assert.equal(incidents.includes("listTasks("), false)

  const update = readFileSync(
    resolve(import.meta.dirname, "../components/tareas/tasks-provider/hooks/use-tasks-update.ts"),
    "utf8"
  )
  const updateStart = update.indexOf("const updateTaskFields = useCallback")
  const updateBlock = update.slice(
    updateStart,
    update.indexOf("const editTask = useCallback")
  )
  assert.match(updateBlock, /auditOptions\?\.existingTask\?\.id === id/)
  assert.match(updateBlock, /updateTaskInSupabase\(id, enrichedPayload, client\)/)

  const tab = readFileSync(
    resolve(import.meta.dirname, "../components/obras/project-tabs/tasks-tab.tsx"),
    "utf8"
  )
  assert.match(
    tab,
    /releaseProjectTaskToField\(task\.id, \{ actor: actorName, task \}\)/
  )
  assert.match(tab, /Enviar a Cuadrilla/)

  const queries = readFileSync(
    resolve(import.meta.dirname, "../lib/supabase/tasks.queries.ts"),
    "utf8"
  )
  const liveStart = queries.indexOf(
    "export async function fetchLiveTaskByCompanyAndId("
  )
  const liveEnd = queries.indexOf("export async function fetchTaskById(")
  const liveBlock = queries.slice(liveStart, liveEnd)
  assert.ok(liveStart > 0)
  assert.equal(liveBlock.includes("fetchTasks("), false)
  assert.match(liveBlock, /\.eq\("company_id", companyId\)/)
  assert.match(liveBlock, /\.eq\("id", id\)/)
  assert.match(liveBlock, /\.is\("deleted_at", null\)/)

  const fetchTasksStart = queries.indexOf("export async function fetchTasks(")
  const fetchTasksEnd = queries.indexOf(
    "export async function fetchActiveWorkOrderListTasks("
  )
  const fetchTasksBlock = queries.slice(fetchTasksStart, fetchTasksEnd)
  assert.equal(fetchTasksBlock.includes(".range("), false)
  assert.equal(fetchTasksBlock.includes('.eq("id"'), false)

  const browser = readFileSync(
    resolve(import.meta.dirname, "../lib/supabase/tasks.browser.ts"),
    "utf8"
  )
  assert.match(browser, /export async function getLiveTaskByCompanyAndId/)
  assert.match(browser, /fetchLiveTaskByCompanyAndId\(client, companyId, id\)/)
})
