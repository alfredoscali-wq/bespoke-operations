/**
 * Sprint 3 — individual access to Obra OTs by company_id + task_id.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  LIVE_COMPANY_TASK_NOT_FOUND_MESSAGE,
  loadLiveCompanyTask,
  TASK_IDENTITY_UNRESOLVED_MESSAGE,
} from "../lib/tasks/live-company-task.ts"
import {
  isTaskInActiveWorkOrderList,
  resolveTaskDetailPageAccess,
  shouldFetchLiveTaskForDetailPage,
} from "../lib/tasks/task-direct-access.ts"
import { prepareTaskWorkflowAction } from "../lib/tasks/task-workflow-resolve.ts"
import { getTransitionForAction } from "../lib/tasks/task-status-workflow.ts"
import {
  OPERATIONAL_CHECKLIST_TEMPLATE_KEY,
  readOperationalChecklistTemplate,
  shouldShowOperationalChecklistForTask,
} from "../lib/tasks/operational-checklist-template.ts"
import {
  OPERATIONAL_CHECKLIST_RESPONSES_KEY,
  buildOperationalChecklistDisplayItems,
  readOperationalChecklistResponses,
} from "../lib/tasks/operational-checklist-responses.ts"
import { matchesActiveWorkOrderListQuery } from "../lib/tasks/task-list-scope.ts"

const root = resolve(import.meta.dirname, "..")

function read(rel) {
  return readFileSync(resolve(root, rel), "utf8")
}

const COMPANY_ID = "00000000-0000-4000-8000-000000000002"
const DOROTEA_PROJECT_ID = "9d66e4ed-6625-4a76-9854-471074232ddf"
const FODOR_002_ID = "015c1ea6-3f16-4e30-9a2f-b56f0d000f86"
const POTENCIA_ITEM_ID = "item-potencia"
const REPORTE_ITEM_ID = "item-reporte"
const EVIDENCE_PHOTO_ID = "aaeae3aa-c40d-40dd-bf92-d8f0ddf05d74"

function makeTask(overrides = {}) {
  return {
    id: overrides.id ?? "ot-1",
    code: overrides.code ?? "TSK-OT-004",
    title: overrides.title ?? "OT",
    description: "",
    projectId: overrides.projectId,
    projectCode: overrides.projectCode ?? "OT",
    projectName: overrides.projectName ?? "Servicio",
    type: "fiber",
    status: overrides.status ?? "asignada",
    priority: "media",
    supervisor: "Supervisor",
    crewId: "crew-1",
    crew: "Cuadrilla 1",
    startDate: "2026-07-13",
    dueDate: overrides.dueDate ?? "2026-07-13",
    estimatedDuration: "120",
    checklist: [],
    progress: 0,
    deletedAt: overrides.deletedAt ?? null,
    taskMetadata: overrides.taskMetadata,
    ...overrides,
  }
}

function makeFodor002(overrides = {}) {
  return makeTask({
    id: FODOR_002_ID,
    code: "TSK-FODOR-002",
    title: "Certificacion Dorotea 002",
    projectId: DOROTEA_PROJECT_ID,
    projectCode: "FO-DOR",
    projectName: "Certificacion Dorotea",
    status: "pendiente-cierre",
    dueDate: "2026-09-23",
    taskMetadata: {
      [OPERATIONAL_CHECKLIST_TEMPLATE_KEY]: [
        {
          id: POTENCIA_ITEM_ID,
          title: "POTENCIA",
          fieldType: "fotografia",
          required: true,
          sortOrder: 1,
        },
        {
          id: REPORTE_ITEM_ID,
          title: "REPORTE",
          fieldType: "entrada-datos",
          required: true,
          sortOrder: 2,
        },
      ],
      [OPERATIONAL_CHECKLIST_RESPONSES_KEY]: {
        [POTENCIA_ITEM_ID]: { photoIds: [EVIDENCE_PHOTO_ID] },
        [REPORTE_ITEM_ID]: { textValue: "Se midio caja" },
      },
    },
    ...overrides,
  })
}

function notFoundLookup() {
  return {
    data: null,
    error: {
      code: "NOT_FOUND",
      message: LIVE_COMPANY_TASK_NOT_FOUND_MESSAGE,
    },
  }
}

function liveLookupFrom(rows, { allowDeleted = false } = {}) {
  const byKey = new Map(
    rows.map((task) => [`${COMPANY_ID}:${task.id}`, task])
  )
  return async (companyId, taskId) => {
    const task = byKey.get(`${companyId}:${taskId}`)
    if (!task || (!allowDeleted && task.deletedAt)) {
      return notFoundLookup()
    }
    return { data: task, error: null }
  }
}

function firstFetchTasksPage(all) {
  return all.slice(0, 1000)
}

test("A. OT normal activa: /tareas/[id] usa el listado actual", () => {
  const listed = makeTask({
    id: "6a41865c-dcfe-4d10-a770-15aa2a662f63",
    code: "TSK-OT-004",
    projectId: null,
    status: "asignada",
  })
  assert.equal(isTaskInActiveWorkOrderList(listed), true)
  assert.equal(
    shouldFetchLiveTaskForDetailPage({
      listedTask: listed,
      requireArchived: false,
      isListReady: true,
      isAuthReady: true,
    }),
    false
  )
  const access = resolveTaskDetailPageAccess({
    listedTask: listed,
    fetchedTask: null,
    isListReady: true,
    isAuthReady: true,
    isFetching: false,
    requireArchived: false,
    archiveFetchState: "idle",
  })
  assert.equal(access.outcome, "show")
  if (access.outcome === "show") {
    assert.equal(access.task.id, listed.id)
  }
})

test("B. OT de Obra: /tareas/[id] funciona con project_id", async () => {
  const fod002 = makeFodor002()
  assert.equal(matchesActiveWorkOrderListQuery(fod002), false)
  assert.equal(isTaskInActiveWorkOrderList(fod002), false)
  assert.equal(
    shouldFetchLiveTaskForDetailPage({
      listedTask: null,
      requireArchived: false,
      isListReady: true,
      isAuthReady: true,
    }),
    true
  )

  const loaded = await loadLiveCompanyTask(fod002.id, COMPANY_ID, {
    loadLiveTask: liveLookupFrom([fod002]),
  })
  assert.equal(loaded.ok, true)
  if (!loaded.ok) return

  const access = resolveTaskDetailPageAccess({
    listedTask: null,
    fetchedTask: loaded.task,
    isListReady: true,
    isAuthReady: true,
    isFetching: false,
    requireArchived: false,
    archiveFetchState: "idle",
  })
  assert.equal(access.outcome, "show")
  if (access.outcome === "show") {
    assert.equal(access.task.projectId, DOROTEA_PROJECT_ID)
    assert.equal(access.task.code, "TSK-FODOR-002")
  }
})

test("C. OT de Obra fuera del límite de 1000 funciona", async () => {
  const fod002 = makeFodor002()
  const ranked = Array.from({ length: 1095 }, (_, index) =>
    makeTask({
      id: `rank-${index + 1}`,
      dueDate: "2026-07-13",
      projectId: null,
    })
  )
  ranked.push(fod002)
  const providerTasks = firstFetchTasksPage(ranked)
  assert.equal(providerTasks.length, 1000)
  assert.equal(
    providerTasks.find((item) => item.id === FODOR_002_ID),
    undefined
  )
  assert.ok(ranked.length > 1000)

  let liveCalls = 0
  const loaded = await loadLiveCompanyTask(FODOR_002_ID, COMPANY_ID, {
    loadedTask: providerTasks.find((item) => item.id === FODOR_002_ID) ?? null,
    loadLiveTask: async (companyId, taskId) => {
      liveCalls += 1
      return liveLookupFrom([fod002])(companyId, taskId)
    },
  })
  assert.equal(liveCalls, 1)
  assert.equal(loaded.ok, true)
  if (loaded.ok) {
    assert.equal(loaded.task.code, "TSK-FODOR-002")
  }
})

test("D. OT inexistente sigue notFound", async () => {
  const loaded = await loadLiveCompanyTask("missing-id", COMPANY_ID, {
    loadLiveTask: liveLookupFrom([]),
  })
  assert.equal(loaded.ok, false)

  const access = resolveTaskDetailPageAccess({
    listedTask: null,
    fetchedTask: null,
    isListReady: true,
    isAuthReady: true,
    isFetching: false,
    requireArchived: false,
    archiveFetchState: "idle",
  })
  assert.equal(access.outcome, "not-found")
})

test("E. OT deleted no permite acceso", async () => {
  const deleted = makeFodor002({
    deletedAt: "2026-09-23T18:00:00Z",
  })
  const loaded = await loadLiveCompanyTask(deleted.id, COMPANY_ID, {
    loadLiveTask: liveLookupFrom([deleted]),
  })
  assert.equal(loaded.ok, false)
  if (!loaded.ok) {
    assert.equal(loaded.message, LIVE_COMPANY_TASK_NOT_FOUND_MESSAGE)
  }
})

test("F. Revisar cierre de OT de Obra no depende de fetchTasks", async () => {
  const fod002 = makeFodor002()
  const providerTasks = firstFetchTasksPage(
    Array.from({ length: 1000 }, (_, index) =>
      makeTask({ id: `cap-${index}` })
    )
  )
  assert.equal(
    providerTasks.find((item) => item.id === FODOR_002_ID),
    undefined
  )

  const fromProjectTab = await loadLiveCompanyTask(fod002.id, COMPANY_ID, {
    loadedTask: fod002,
    loadLiveTask: async () => {
      throw new Error("projectTasks payload must be enough for Revisar cierre")
    },
  })
  assert.equal(fromProjectTab.ok, true)

  const fromLive = await loadLiveCompanyTask(fod002.id, COMPANY_ID, {
    loadedTask: providerTasks.find((item) => item.id === FODOR_002_ID) ?? null,
    loadLiveTask: liveLookupFrom([fod002]),
  })
  assert.equal(fromLive.ok, true)
  assert.equal(TASK_IDENTITY_UNRESOLVED_MESSAGE.includes("identificar"), true)
})

test("G. Aprobar cierre funciona por taskId", async () => {
  const fod002 = makeFodor002()
  const listed = firstFetchTasksPage(
    Array.from({ length: 1000 }, (_, index) => makeTask({ id: `cap-${index}` }))
  )
  const prepared = await prepareTaskWorkflowAction(
    fod002.id,
    COMPANY_ID,
    "approve",
    {
      listedTask: listed.find((item) => item.id === fod002.id) ?? null,
      loadLiveTask: liveLookupFrom([fod002]),
    }
  )
  assert.equal(prepared.ok, true)
  if (prepared.ok) {
    assert.equal(prepared.to, "finalizada")
    assert.equal(prepared.task.status, "pendiente-cierre")
  }
  assert.deepEqual(getTransitionForAction("approve"), {
    from: ["pendiente-cierre", "en-aprobacion"],
    to: "finalizada",
  })
})

test("H. Solicitar corrección funciona por taskId", async () => {
  const fod002 = makeFodor002()
  const prepared = await prepareTaskWorkflowAction(
    fod002.id,
    COMPANY_ID,
    "reject",
    {
      listedTask: null,
      loadLiveTask: liveLookupFrom([fod002]),
    }
  )
  assert.equal(prepared.ok, true)
  if (prepared.ok) {
    assert.equal(prepared.to, "en-curso")
  }
  assert.deepEqual(getTransitionForAction("reject"), {
    from: ["pendiente-cierre", "en-aprobacion"],
    to: "en-curso",
  })
})

test("I. Checklist carga template + responses + evidencia", () => {
  const fod002 = makeFodor002()
  assert.equal(shouldShowOperationalChecklistForTask(fod002), true)

  const template = readOperationalChecklistTemplate(fod002)
  assert.deepEqual(
    template.map((item) => item.title),
    ["POTENCIA", "REPORTE"]
  )
  assert.equal(template[0].fieldType, "fotografia")
  assert.equal(template[1].fieldType, "entrada-datos")

  const responses = readOperationalChecklistResponses(fod002)
  assert.deepEqual(responses[POTENCIA_ITEM_ID].photoIds, [EVIDENCE_PHOTO_ID])
  assert.equal(responses[REPORTE_ITEM_ID].textValue, "Se midio caja")

  const items = buildOperationalChecklistDisplayItems({
    template,
    responses,
    includeUnanswered: true,
  })
  assert.equal(items.length, 2)
  assert.equal(items[0].label, "POTENCIA")
  assert.equal(items[0].hasResponse, true)
  assert.equal(items[1].label, "REPORTE")
  assert.equal(items[1].textValue, "Se midio caja")

  const evidence = [
    {
      id: EVIDENCE_PHOTO_ID,
      taskId: FODOR_002_ID,
      photoType: "evidence",
    },
  ]
  assert.equal(evidence[0].taskId, fod002.id)
})

test("J. Acciones individuales no dependen de listados globales", () => {
  const detailPage = read("components/tareas/task-detail-page-client.tsx")
  assert.match(detailPage, /getLiveTaskByCompanyAndId/)
  assert.match(detailPage, /shouldFetchLiveTaskForDetailPage/)
  assert.equal(detailPage.includes("fetchTasks("), false)
  assert.equal(detailPage.includes("listTasks("), false)
  assert.equal(detailPage.includes("listActiveWorkOrderTasks"), false)

  const sheet = read("components/obras/project-task-closure-review-sheet.tsx")
  assert.match(sheet, /loadLiveCompanyTask/)
  assert.match(sheet, /getLiveTaskByCompanyAndId/)
  assert.match(sheet, /approveTask\(task\.id, \{ task \}\)/)
  assert.match(sheet, /rejectTask\(task\.id, reason, \{ task \}\)/)
  assert.equal(sheet.includes("getTask("), false)
  assert.equal(sheet.includes("tasks.find("), false)
  assert.equal(sheet.includes("fetchTasks("), false)

  const tab = read("components/obras/project-tabs/tasks-tab.tsx")
  assert.match(tab, /setClosureReviewTask\(task\)/)
  assert.match(tab, /task=\{closureReviewTask\}/)

  const workflow = read(
    "components/tareas/tasks-provider/hooks/use-tasks-workflow.ts"
  )
  const approveStart = workflow.indexOf("const approveTask = useCallback")
  const rejectStart = workflow.indexOf("const rejectTask = useCallback")
  const assignStart = workflow.indexOf("const assignCrew = useCallback")
  const approveBlock = workflow.slice(approveStart, rejectStart)
  const rejectBlock = workflow.slice(rejectStart, assignStart)
  assert.match(approveBlock, /applyWorkflowTransition\(id, "approve"/)
  assert.match(approveBlock, /task: options\?\.task/)
  assert.match(rejectBlock, /prepareTaskWorkflowAction/)
  assert.match(rejectBlock, /getLiveTaskByCompanyAndId/)
  assert.match(rejectBlock, /existingTask: task/)
  assert.equal(approveBlock.includes("fetchTasks("), false)
  assert.equal(rejectBlock.includes("fetchTasks("), false)

  const applyStart = workflow.indexOf(
    "const applyWorkflowTransition = useCallback"
  )
  const applyBlock = workflow.slice(
    applyStart,
    workflow.indexOf("const changeTaskStatus = useCallback")
  )
  assert.match(applyBlock, /prepareTaskWorkflowAction/)
  assert.match(applyBlock, /getLiveTaskByCompanyAndId/)
  assert.match(applyBlock, /existingTask: task/)

  const queries = read("lib/supabase/tasks.queries.ts")
  const activeStart = queries.indexOf(
    "export async function fetchActiveWorkOrderListTasks("
  )
  const activeBlock = queries.slice(
    activeStart,
    queries.indexOf("export async function fetchPlanningWorkOrderListTasks(")
  )
  assert.match(activeBlock, /\.is\("project_id", null\)/)

  const adminChecklist = read(
    "components/tareas/task-admin-operational-checklist.tsx"
  )
  assert.match(adminChecklist, /listTaskEvidencePhotos\(task\.id\)/)
  assert.match(adminChecklist, /readOperationalChecklistTemplate\(task\)/)
  assert.match(adminChecklist, /readOperationalChecklistResponses\(task\)/)
})

test("Regresión TSK-FODOR-002: detalle + checklist + cierre + workflow", async () => {
  const fod002 = makeFodor002()
  assert.ok(fod002.projectId)
  assert.equal(fod002.status, "pendiente-cierre")
  assert.equal(isTaskInActiveWorkOrderList(fod002), false)

  const earlier = Array.from({ length: 1031 }, (_, index) =>
    makeTask({
      id: `earlier-${index}`,
      dueDate: "2026-07-13",
      projectId: null,
    })
  )
  const fetchTasksRank = earlier.length + 1
  assert.ok(fetchTasksRank > 1000)

  const providerTasks = firstFetchTasksPage([...earlier, fod002])
  assert.equal(
    providerTasks.find((item) => item.id === FODOR_002_ID),
    undefined
  )

  const detail = await loadLiveCompanyTask(FODOR_002_ID, COMPANY_ID, {
    loadedTask: providerTasks.find((item) => item.id === FODOR_002_ID) ?? null,
    loadLiveTask: liveLookupFrom([fod002]),
  })
  assert.equal(detail.ok, true)

  const closure = await loadLiveCompanyTask(FODOR_002_ID, COMPANY_ID, {
    loadedTask: fod002,
    loadLiveTask: async () => {
      throw new Error("Revisar cierre must use the Obra tab task object")
    },
  })
  assert.equal(closure.ok, true)

  const template = readOperationalChecklistTemplate(fod002)
  const responses = readOperationalChecklistResponses(fod002)
  assert.equal(template.some((item) => item.title === "POTENCIA"), true)
  assert.equal(template.some((item) => item.title === "REPORTE"), true)
  assert.equal(Boolean(responses[POTENCIA_ITEM_ID]?.photoIds?.length), true)
  assert.equal(responses[REPORTE_ITEM_ID]?.textValue, "Se midio caja")

  const approve = await prepareTaskWorkflowAction(
    FODOR_002_ID,
    COMPANY_ID,
    "approve",
    {
      loadedTask: fod002,
      listedTask: null,
      loadLiveTask: async () => {
        throw new Error("approve must use the resolved task object")
      },
    }
  )
  assert.equal(approve.ok, true)
  if (approve.ok) assert.equal(approve.to, "finalizada")

  const reject = await prepareTaskWorkflowAction(
    FODOR_002_ID,
    COMPANY_ID,
    "reject",
    {
      loadedTask: fod002,
      listedTask: null,
      loadLiveTask: async () => {
        throw new Error("reject must use the resolved task object")
      },
    }
  )
  assert.equal(reject.ok, true)
  if (reject.ok) assert.equal(reject.to, "en-curso")
})

test("loadedTask evita la consulta puntual", async () => {
  const normal = makeTask({ projectId: null, status: "en-curso" })
  const result = await loadLiveCompanyTask(normal.id, COMPANY_ID, {
    loadedTask: normal,
    loadLiveTask: async () => {
      throw new Error("listed/loaded OT must not hit live lookup")
    },
  })
  assert.equal(result.ok, true)
})

test("consulta puntual usa company_id + task_id", async () => {
  const fod002 = makeFodor002()
  let seenCompany = ""
  let seenTask = ""
  await loadLiveCompanyTask(fod002.id, COMPANY_ID, {
    loadLiveTask: async (companyId, taskId) => {
      seenCompany = companyId
      seenTask = taskId
      return liveLookupFrom([fod002])(companyId, taskId)
    },
  })
  assert.equal(seenCompany, COMPANY_ID)
  assert.equal(seenTask, FODOR_002_ID)
})
