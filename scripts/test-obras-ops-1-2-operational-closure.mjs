import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  buildFinalizeBlockedOpenTasksMessage,
  buildFinalizeProjectHistoryDescription,
  countOpenTasksForProjectFinalize,
  isOpenTaskStatusForProjectFinalize,
  parseFinalizeProjectRpcResult,
  PROJECT_FINALIZE_BLOCKING_TASK_STATUSES,
  validateFinalizeProject,
} from "../lib/projects/project-finalize.ts"
import {
  canAccessObrasModuleForFinalize,
  canAccessObrasModuleForStart,
} from "../lib/projects/obra-task-insert-integrity.ts"
import { resolveProjectTaskRowActions } from "../lib/projects/project-task-row-actions.ts"
import {
  canEditProjectTaskFromObras,
  shouldApplyPlanningQueueSideEffectsForTask,
} from "../lib/projects/project-start-dispatch.ts"
import { canTransitionProjectStatus } from "../lib/projects/utils.ts"
import { PROJECT_FINALIZE_BLOCKED_OPEN_TASKS_MESSAGE } from "../lib/operations/user-messages.ts"
import {
  ACTIVE_TASK_STATUSES,
  FINAL_TASK_STATUSES,
  isProjectFinalizeBlockingTaskStatus,
} from "../lib/tasks/status-groups.ts"
import {
  getTransitionForAction,
  isPendingClosureStatus,
} from "../lib/tasks/task-status-workflow.ts"
import { canSoftDeleteWorkOrder } from "../lib/tasks/work-order-deletion-policy.ts"
import { getProjectOperationalStats } from "../lib/projects/utils.ts"
import {
  createEmptyModuleVisibility,
  createFullModuleVisibility,
} from "../lib/roles/app-modules.ts"

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20261004000100_obras_ops_1_2_finalize_project_operational.sql"
)

const FINALIZE_API_PATH = join(
  process.cwd(),
  "app/api/projects/[projectId]/finalize/route.ts"
)

const CLOSURE_SHEET_PATH = join(
  process.cwd(),
  "components/obras/project-task-closure-review-sheet.tsx"
)

const PROJECT_ID = "project-a"
const OTHER_PROJECT_ID = "project-b"

function makeObraTask(overrides = {}) {
  return {
    id: "task-1",
    status: "programada",
    projectId: PROJECT_ID,
    ...overrides,
  }
}

const BLOCKING_STATUSES = [
  "programada",
  "asignada",
  "vencida",
  "en-curso",
  "incidencia",
  "pendiente-cierre",
  "en-aprobacion",
  "pendiente",
]

const NON_BLOCKING_STATUSES = ["finalizada", "cancelada", "cerrada"]

for (const status of BLOCKING_STATUSES) {
  test(`finalizar obra bloqueada con OT ${status}`, () => {
    const result = validateFinalizeProject({
      projectStatus: "active",
      tasks: [makeObraTask({ status, id: `task-${status}` })],
    })

    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.match(result.message, /Ã³rdenes de trabajo abiertas/i)
    }
  })
}

for (const status of NON_BLOCKING_STATUSES) {
  test(`finalizar obra permitida con OT ${status}`, () => {
    const result = validateFinalizeProject({
      projectStatus: "active",
      tasks: [makeObraTask({ status, id: `task-${status}` })],
    })

    assert.equal(result.ok, true)
  })
}

test("finalizar obra sin OT puede finalizar", () => {
  const result = validateFinalizeProject({
    projectStatus: "active",
    tasks: [],
  })

  assert.equal(result.ok, true)
})

test("finalizar obra: tarea de otra obra no bloquea", () => {
  const result = validateFinalizeProject({
    projectStatus: "active",
    projectId: PROJECT_ID,
    tasks: [
      makeObraTask({ status: "en-curso", projectId: OTHER_PROJECT_ID }),
      makeObraTask({ status: "finalizada" }),
    ],
  })

  assert.equal(result.ok, true)
})

test("finalizar obra: OT normales sin projectId no bloquean", () => {
  const result = validateFinalizeProject({
    projectStatus: "active",
    tasks: [
      { id: "ot-normal", status: "en-curso", projectId: undefined },
      makeObraTask({ status: "finalizada" }),
    ],
  })

  assert.equal(result.ok, true)
})

test("finalizar obra: estado invÃ¡lido de project rechazado", () => {
  const result = validateFinalizeProject({
    projectStatus: "planned",
    tasks: [],
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.message, /Activa|Pausada|Planificada/i)
  }
})

test("finalizar obra pausada sin OT abiertas puede finalizar", () => {
  const result = validateFinalizeProject({
    projectStatus: "paused",
    tasks: [makeObraTask({ status: "finalizada" })],
  })

  assert.equal(result.ok, true)
})

test("mensaje de bloqueo incluye cantidad de OT pendientes", () => {
  const message = buildFinalizeBlockedOpenTasksMessage(3)
  assert.match(message, /3 pendientes/)
  assert.match(message, /Ã³rdenes de trabajo abiertas/i)
})

test("historial de finalizaciÃ³n describe transiciÃ³n", () => {
  assert.match(
    buildFinalizeProjectHistoryDescription("active"),
    /Activa a Finalizada/
  )
  assert.match(
    buildFinalizeProjectHistoryDescription("paused"),
    /Pausada a Finalizada/
  )
})

test("parseFinalizeProjectRpcResult acepta respuesta vÃ¡lida", () => {
  const parsed = parseFinalizeProjectRpcResult({
    project_id: PROJECT_ID,
    previous_status: "active",
    next_status: "closed",
    open_task_count: 0,
  })

  assert.ok(parsed)
  assert.equal(parsed?.projectId, PROJECT_ID)
  assert.equal(parsed?.previousStatus, "active")
  assert.equal(parsed?.nextStatus, "closed")
})

test("parseFinalizeProjectRpcResult rechaza respuesta invÃ¡lida", () => {
  assert.equal(parseFinalizeProjectRpcResult(null), null)
  assert.equal(
    parseFinalizeProjectRpcResult({
      project_id: PROJECT_ID,
      previous_status: "planned",
      next_status: "closed",
    }),
    null
  )
})

test("PROJECT_FINALIZE_BLOCKING_TASK_STATUSES incluye legacy pendiente", () => {
  assert.ok(PROJECT_FINALIZE_BLOCKING_TASK_STATUSES.includes("pendiente"))
  assert.ok(isProjectFinalizeBlockingTaskStatus("pendiente"))
})

test("countOpenTasksForProjectFinalize cuenta solo tareas de la obra", () => {
  assert.equal(
    countOpenTasksForProjectFinalize(
      [
        makeObraTask({ status: "en-curso" }),
        makeObraTask({
          id: "task-2",
          status: "programada",
          projectId: OTHER_PROJECT_ID,
        }),
        { id: "task-3", status: "en-curso", projectId: undefined },
      ],
      PROJECT_ID
    ),
    1
  )
})

test("migraciÃ³n finalize_project_operational: FOR UPDATE y multi-tenant", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8")

  assert.match(sql, /finalize_project_operational/)
  assert.match(sql, /FOR UPDATE/)
  assert.match(sql, /p\.company_id = p_company_id/)
  assert.match(sql, /p\.deleted_at IS NULL/)
  assert.match(sql, /t\.company_id = p_company_id/)
  assert.match(sql, /t\.deleted_at IS NULL/)
  assert.match(sql, /programada/)
  assert.match(sql, /pendiente-cierre/)
  assert.match(sql, /pendiente'::public\.task_status/)
  assert.match(sql, /status = 'closed'::public\.project_status/)
  assert.match(sql, /SECURITY DEFINER/)
  assert.match(sql, /SET search_path = public/)
  assert.match(sql, /auth_is_demo_platform_read_only/)
  assert.match(sql, /Ã³rdenes de trabajo abiertas/)
  assert.doesNotMatch(sql, /UPDATE public\.tasks/)
  assert.doesNotMatch(sql, /GRANT EXECUTE[\s\S]*TO authenticated/)
  assert.match(sql, /GRANT EXECUTE[\s\S]*TO service_role/)
})

test("migraciÃ³n: atomicidad âÿÿ solo actualiza project si no hay OT abiertas", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8")
  const openCountIdx = sql.indexOf("v_open_task_count")
  const updateIdx = sql.indexOf("UPDATE public.projects")
  const raiseIdx = sql.indexOf("No se puede finalizar la Obra")

  assert.ok(raiseIdx > 0)
  assert.ok(openCountIdx > 0 && openCountIdx < updateIdx)
})

test("API finalize: sesiÃ³n writable + mÃ³dulo projects + prefetch tenant", () => {
  const source = readFileSync(FINALIZE_API_PATH, "utf8")

  assert.match(source, /requireWritablePlatformSession/)
  assert.match(source, /canAccessObrasModuleForStart/)
  assert.match(source, /auth\.sessionUser\.companyId/)
  assert.match(source, /fetchProjectById\(client, projectId, companyId\)/)
  assert.match(source, /finalizeProjectOperational/)
  assert.match(source, /recordProjectStatusChangeAuditFromTransition/)
  assert.doesNotMatch(source, /request\.json/)
})

test("API finalize: module access rechazado sin projects", () => {
  assert.equal(
    canAccessObrasModuleForFinalize({
      systemRole: "operario",
      roleCode: "operario",
      moduleVisibility: createEmptyModuleVisibility(),
    }),
    false
  )
})

test("API finalize: module access permitido con projects", () => {
  assert.equal(
    canAccessObrasModuleForFinalize({
      systemRole: "supervisor",
      roleCode: "supervisor",
      moduleVisibility: createFullModuleVisibility(),
    }),
    true
  )
  assert.equal(canAccessObrasModuleForFinalize, canAccessObrasModuleForStart)
})

test("reapertura closed âÿÿ active sin regresiÃ³n", () => {
  const reopen = canTransitionProjectStatus("closed", "active")
  assert.equal(reopen.allowed, true)

  const finalizeFromClosed = canTransitionProjectStatus("closed", "closed")
  assert.equal(finalizeFromClosed.allowed, false)
})

test("acciÃ³n Ver disponible para todas las OT de obra", () => {
  for (const status of [
    ...BLOCKING_STATUSES,
    ...NON_BLOCKING_STATUSES,
  ]) {
    const actions = resolveProjectTaskRowActions(
      makeObraTask({ status })
    )
    assert.equal(actions.showView, true, `status ${status}`)
  }
})

test("acciÃ³n Editar programada disponible", () => {
  const actions = resolveProjectTaskRowActions(
    makeObraTask({ status: "programada" })
  )
  assert.equal(actions.showEdit, true)
  assert.equal(canEditProjectTaskFromObras(makeObraTask({ status: "programada" })), true)
})

test("acciÃ³n Editar asignada disponible", () => {
  const actions = resolveProjectTaskRowActions(
    makeObraTask({ status: "asignada" })
  )
  assert.equal(actions.showEdit, true)
})

test("acciÃ³n Editar en-curso no disponible", () => {
  const actions = resolveProjectTaskRowActions(
    makeObraTask({ status: "en-curso" })
  )
  assert.equal(actions.showEdit, false)
})

test("acciÃ³n Eliminar programada disponible", () => {
  const actions = resolveProjectTaskRowActions(
    makeObraTask({ status: "programada" })
  )
  assert.equal(actions.showDelete, true)
  assert.equal(canSoftDeleteWorkOrder("programada"), true)
})

test("accion Eliminar asignada de Obra disponible si no inicio", () => {
  const actions = resolveProjectTaskRowActions(
    makeObraTask({ status: "asignada" })
  )
  assert.equal(actions.showDelete, true)
  assert.equal(
    canSoftDeleteWorkOrder(makeObraTask({ status: "asignada" })),
    true
  )
})

test("accion Eliminar asignada sin Obra no disponible", () => {
  const actions = resolveProjectTaskRowActions({
    status: "asignada",
    projectId: undefined,
  })
  assert.equal(actions.showDelete, false)
})

test("accion Eliminar estados posteriores no disponible", () => {
  for (const status of [
    "vencida",
    "en-curso",
    "incidencia",
    "pendiente-cierre",
    "en-aprobacion",
    "finalizada",
    "cancelada",
    "cerrada",
  ]) {
    const actions = resolveProjectTaskRowActions(makeObraTask({ status }))
    assert.equal(actions.showDelete, false, `status ${status}`)
  }
})

test("pendiente-cierre muestra Revisar cierre", () => {
  const actions = resolveProjectTaskRowActions(
    makeObraTask({ status: "pendiente-cierre" })
  )
  assert.equal(actions.showReviewClosure, true)
  assert.equal(isPendingClosureStatus("pendiente-cierre"), true)
})

test("en-aprobacion tambiÃ©n muestra Revisar cierre", () => {
  const actions = resolveProjectTaskRowActions(
    makeObraTask({ status: "en-aprobacion" })
  )
  assert.equal(actions.showReviewClosure, true)
})

test("aprobar cierre: pendiente-cierre âÿÿ finalizada", () => {
  const transition = getTransitionForAction("approve")
  assert.ok(transition.from.includes("pendiente-cierre"))
  assert.equal(transition.to, "finalizada")
})

test("rechazar cierre: pendiente-cierre âÿÿ en-curso", () => {
  const transition = getTransitionForAction("reject")
  assert.ok(transition.from.includes("pendiente-cierre"))
  assert.equal(transition.to, "en-curso")
})

test("OT de obra no aplica side-effects de PlanificaciÃ³n", () => {
  assert.equal(
    shouldApplyPlanningQueueSideEffectsForTask({ projectId: PROJECT_ID }),
    false
  )
  assert.equal(
    shouldApplyPlanningQueueSideEffectsForTask({ projectId: null }),
    true
  )
})

test("OT normales sin project_id mantienen reglas de ediciÃ³n admin", () => {
  assert.equal(
    canEditProjectTaskFromObras({ projectId: null, status: "asignada" }),
    false
  )
})

test("KPIs: pendiente-cierre cuenta como activa y finalizada como completada", () => {
  const stats = getProjectOperationalStats(
    { id: PROJECT_ID, code: "OB-1", progress: 0 },
    [
      makeObraTask({
        id: "t1",
        status: "pendiente-cierre",
        code: "T1",
        title: "A",
        type: "maintenance",
        priority: "medium",
        supervisor: "",
        crew: "",
        startDate: "2026-07-01",
        dueDate: "2026-07-02",
        projectCode: "OB-1",
        projectName: "Obra",
      }),
      makeObraTask({
        id: "t2",
        status: "finalizada",
        code: "T2",
        title: "B",
        type: "maintenance",
        priority: "medium",
        supervisor: "",
        crew: "",
        startDate: "2026-07-01",
        dueDate: "2026-07-02",
        projectCode: "OB-1",
        projectName: "Obra",
      }),
    ],
    []
  )

  assert.equal(stats.activeTasks, 1)
  assert.equal(stats.completedTasks, 1)
  assert.ok(ACTIVE_TASK_STATUSES.includes("pendiente-cierre"))
  assert.ok(FINAL_TASK_STATUSES.includes("finalizada"))
})

test("KPIs tras approve: finalizada deja de contar como activa", () => {
  const stats = getProjectOperationalStats(
    { id: PROJECT_ID, code: "OB-1", progress: 0 },
    [
      makeObraTask({
        id: "t1",
        status: "finalizada",
        code: "T1",
        title: "A",
        type: "maintenance",
        priority: "medium",
        supervisor: "",
        crew: "",
        startDate: "2026-07-01",
        dueDate: "2026-07-02",
        projectCode: "OB-1",
        projectName: "Obra",
      }),
    ],
    []
  )

  assert.equal(stats.activeTasks, 0)
  assert.equal(stats.completedTasks, 1)
})

test("sheet de revisiÃ³n reutiliza PlanningPendingClosureDetailPanel", () => {
  const source = readFileSync(CLOSURE_SHEET_PATH, "utf8")

  assert.match(source, /PlanningPendingClosureDetailPanel/)
  assert.match(source, /approveTask/)
  assert.match(source, /rejectTask/)
  assert.match(source, /canAccessObrasModuleForStart/)
  assert.match(source, /project-task-closure-review-sheet/)
})

test("mensaje base de bloqueo coincide con spec", () => {
  assert.equal(
    PROJECT_FINALIZE_BLOCKED_OPEN_TASKS_MESSAGE,
    "No se puede finalizar la Obra mientras existan Ã³rdenes de trabajo abiertas."
  )
})

test("isOpenTaskStatusForProjectFinalize alinea con ACTIVE + pendiente", () => {
  for (const status of ACTIVE_TASK_STATUSES) {
    assert.equal(isOpenTaskStatusForProjectFinalize(status), true)
  }
  assert.equal(isOpenTaskStatusForProjectFinalize("pendiente"), true)
  assert.equal(isOpenTaskStatusForProjectFinalize("finalizada"), false)
})
