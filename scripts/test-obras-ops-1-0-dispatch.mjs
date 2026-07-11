import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  buildStartProjectDispatchHistoryDescription,
  canEditProjectTaskFromObras,
  parseStartProjectDispatchRpcResult,
  resolveProjectTaskCreateStatus,
  shouldApplyPlanningQueueSideEffectsForTask,
  validateStartProjectDispatch,
} from "../lib/projects/project-start-dispatch.ts"
import {
  canAccessObrasModuleForStart,
  validateObraTaskInsertIntegrity,
} from "../lib/projects/obra-task-insert-integrity.ts"
import { canAdminModifyWorkOrder } from "../lib/tasks/work-order-admin-mutation.ts"
import { shouldRecalculateAdminWorkOrderExecutionOrder } from "../lib/tasks/work-order-admin-execution-order.ts"
import { canSoftDeleteWorkOrder } from "../lib/tasks/work-order-deletion-policy.ts"
import { isFieldAgentAgendaTaskVisible } from "../lib/mobile/v1/agenda/agenda-task-visibility.ts"
import {
  createEmptyModuleVisibility,
  createFullModuleVisibility,
} from "../lib/roles/app-modules.ts"

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20261001000100_obras_ops_1_0_start_project_dispatch.sql"
)

const HOTFIX_MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20261002000100_obras_ops_1_0_active_project_task_status_hotfix.sql"
)

function makeObraTask(overrides = {}) {
  return {
    id: "task-1",
    code: "TSK-OB-1",
    status: "programada",
    crewId: "crew-1",
    dueDate: "2026-07-15",
    projectId: "project-1",
    ...overrides,
  }
}

test("obra planned puede iniciar con tareas válidas", () => {
  const result = validateStartProjectDispatch({
    projectStatus: "planned",
    tasks: [makeObraTask()],
  })

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.dispatchableTasks.length, 1)
  }
})

test("obra sin tareas no puede iniciar", () => {
  const result = validateStartProjectDispatch({
    projectStatus: "planned",
    tasks: [],
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.message, /no tiene tareas/i)
  }
})

test("obra con tarea programada sin cuadrilla no puede iniciar", () => {
  const result = validateStartProjectDispatch({
    projectStatus: "planned",
    tasks: [makeObraTask({ crewId: null, code: "TSK-OB-NOCREW" })],
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.message, /sin cuadrilla/i)
    assert.match(result.message, /TSK-OB-NOCREW/)
  }
})

test("obra con tarea programada sin fecha no puede iniciar", () => {
  const result = validateStartProjectDispatch({
    projectStatus: "planned",
    tasks: [makeObraTask({ dueDate: "", code: "TSK-OB-NODATE" })],
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.message, /sin fecha/i)
    assert.match(result.message, /TSK-OB-NODATE/)
  }
})

test("solo planned puede iniciar", () => {
  const result = validateStartProjectDispatch({
    projectStatus: "active",
    tasks: [makeObraTask()],
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.message, /Planificada/)
  }
})

test("tarea con fecha futura también es despachable a asignada", () => {
  const result = validateStartProjectDispatch({
    projectStatus: "planned",
    tasks: [makeObraTask({ dueDate: "2099-01-01" })],
  })

  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.dispatchableTasks[0]?.dueDate, "2099-01-01")
  }
})

test("historial de despacho menciona cantidad de tareas", () => {
  assert.match(
    buildStartProjectDispatchHistoryDescription(3),
    /3 tareas pasaron a Asignada/
  )
  assert.match(
    buildStartProjectDispatchHistoryDescription(1),
    /1 tarea pasó a Asignada/
  )
})

test("Field Agent oculta asignada con fecha futura", () => {
  assert.equal(
    isFieldAgentAgendaTaskVisible(
      { status: "asignada", dueDate: "2026-07-20" },
      "2026-07-11"
    ),
    false
  )

  assert.equal(
    isFieldAgentAgendaTaskVisible(
      { status: "asignada", dueDate: "2026-07-11" },
      "2026-07-11"
    ),
    true
  )
})

test("tarea de Obra asignada puede editarse desde Obras", () => {
  assert.equal(
    canEditProjectTaskFromObras({
      projectId: "project-1",
      status: "asignada",
    }),
    true
  )
  assert.equal(
    canEditProjectTaskFromObras({
      projectId: "project-1",
      status: "programada",
    }),
    true
  )
})

test("OT normal asignada mantiene restricción admin (no editable)", () => {
  assert.equal(canAdminModifyWorkOrder("asignada"), false)
  assert.equal(canAdminModifyWorkOrder("programada"), true)
  assert.equal(
    canEditProjectTaskFromObras({
      projectId: undefined,
      status: "asignada",
    }),
    false
  )
})

test("tarea de Obra en-curso no puede editarse libremente", () => {
  assert.equal(
    canEditProjectTaskFromObras({
      projectId: "project-1",
      status: "en-curso",
    }),
    false
  )
  assert.equal(
    canEditProjectTaskFromObras({
      projectId: "project-1",
      status: "pendiente-cierre",
    }),
    false
  )
  assert.equal(
    canEditProjectTaskFromObras({
      projectId: "project-1",
      status: "finalizada",
    }),
    false
  )
})

test("cambio crew/fecha de tarea Obra no recalcula execution_order de Planificación", () => {
  const existing = {
    status: "asignada",
    crewId: "crew-a",
    dueDate: "2026-07-15",
    projectId: "project-1",
  }

  assert.equal(
    shouldRecalculateAdminWorkOrderExecutionOrder(existing, {
      crewId: "crew-b",
    }),
    false
  )
  assert.equal(
    shouldRecalculateAdminWorkOrderExecutionOrder(existing, {
      dueDate: "2026-07-20",
    }),
    false
  )
  assert.equal(
    shouldApplyPlanningQueueSideEffectsForTask({ projectId: "project-1" }),
    false
  )
})

test("OT normal programada sigue recalculando execution_order ante cambio crew/fecha", () => {
  const existing = {
    status: "programada",
    crewId: "crew-a",
    dueDate: "2026-07-15",
    projectId: undefined,
  }

  assert.equal(
    shouldRecalculateAdminWorkOrderExecutionOrder(existing, {
      crewId: "crew-b",
    }),
    true
  )
  assert.equal(
    shouldApplyPlanningQueueSideEffectsForTask({ projectId: undefined }),
    true
  )
})

test("nueva tarea en obra active nace asignada; planned nace programada", () => {
  assert.equal(resolveProjectTaskCreateStatus("active"), "asignada")
  assert.equal(resolveProjectTaskCreateStatus("planned"), "programada")
  assert.equal(resolveProjectTaskCreateStatus("paused"), "programada")
})

test("soft delete de asignada permanece bloqueado", () => {
  assert.equal(canSoftDeleteWorkOrder("asignada"), false)
  assert.equal(canSoftDeleteWorkOrder("programada"), true)
})

test("parse RPC result multi-tenant payload", () => {
  const parsed = parseStartProjectDispatchRpcResult({
    project_id: "proj-1",
    previous_status: "planned",
    next_status: "active",
    dispatched_count: 2,
    dispatched_task_ids: ["t1", "t2"],
  })

  assert.deepEqual(parsed, {
    projectId: "proj-1",
    previousStatus: "planned",
    nextStatus: "active",
    dispatchedCount: 2,
    dispatchedTaskIds: ["t1", "t2"],
  })
})

test("migración RPC es atómica y service_role only", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8")

  assert.match(sql, /start_project_operational_dispatch/)
  assert.match(sql, /SECURITY DEFINER/)
  assert.match(sql, /FOR UPDATE/)
  assert.match(sql, /status = 'active'::public\.project_status/)
  assert.match(sql, /status = 'asignada'::public\.task_status/)
  assert.match(sql, /execution_order = NULL/)
  assert.match(sql, /GRANT EXECUTE[\s\S]*TO service_role/)
  assert.match(sql, /REVOKE EXECUTE[\s\S]*FROM authenticated/)
  assert.match(sql, /auth_is_demo_platform_read_only/)
  assert.match(sql, /t\.company_id = p_company_id/)
  assert.match(sql, /p\.company_id = p_company_id/)
  assert.match(
    sql,
    /NEW\.status = 'asignada'::public\.task_status[\s\S]*NEW\.project_id IS NOT NULL/
  )
})

const COMPANY_A = "company-a"
const COMPANY_B = "company-b"
const PROJECT_A = "project-a"
const CREW_A = "crew-a"

function makeActiveProject(overrides = {}) {
  return {
    id: PROJECT_A,
    companyId: COMPANY_A,
    status: "active",
    deletedAt: null,
    ...overrides,
  }
}

function makeCrew(overrides = {}) {
  return {
    id: CREW_A,
    companyId: COMPANY_A,
    deletedAt: null,
    ...overrides,
  }
}

function makeAsignadaInsert(overrides = {}) {
  return {
    companyId: COMPANY_A,
    projectId: PROJECT_A,
    crewId: CREW_A,
    status: "asignada",
    ...overrides,
  }
}

test("hardening: asignada con project same-tenant active → permitida", () => {
  const result = validateObraTaskInsertIntegrity({
    task: makeAsignadaInsert(),
    project: makeActiveProject(),
    crew: makeCrew(),
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.status, "asignada")
  }
})

test("hardening: asignada con project de otro tenant → rechazada", () => {
  const result = validateObraTaskInsertIntegrity({
    task: makeAsignadaInsert(),
    project: makeActiveProject({ companyId: COMPANY_B }),
    crew: makeCrew(),
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.message, /tenant|obra/i)
  }
})

test("hardening: asignada con project deleted → rechazada", () => {
  const result = validateObraTaskInsertIntegrity({
    task: makeAsignadaInsert(),
    project: makeActiveProject({ deletedAt: "2026-07-01T00:00:00.000Z" }),
    crew: makeCrew(),
  })
  assert.equal(result.ok, false)
})

test("hardening: asignada con project planned → rechazada", () => {
  const result = validateObraTaskInsertIntegrity({
    task: makeAsignadaInsert(),
    project: makeActiveProject({ status: "planned" }),
    crew: makeCrew(),
  })
  assert.equal(result.ok, false)
})

test("hardening: asignada con project closed → rechazada", () => {
  const result = validateObraTaskInsertIntegrity({
    task: makeAsignadaInsert(),
    project: makeActiveProject({ status: "closed" }),
    crew: makeCrew(),
  })
  assert.equal(result.ok, false)
})

test("hardening: obra con crew same-tenant → permitida", () => {
  const result = validateObraTaskInsertIntegrity({
    task: {
      companyId: COMPANY_A,
      projectId: PROJECT_A,
      crewId: CREW_A,
      status: "programada",
    },
    project: makeActiveProject({ status: "planned" }),
    crew: makeCrew(),
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.status, "programada")
  }
})

test("hardening: obra con crew de otro tenant → rechazada", () => {
  const result = validateObraTaskInsertIntegrity({
    task: makeAsignadaInsert(),
    project: makeActiveProject(),
    crew: makeCrew({ companyId: COMPANY_B }),
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.message, /cuadrilla/i)
  }
})

test("hardening: obra con crew deleted → rechazada", () => {
  const result = validateObraTaskInsertIntegrity({
    task: makeAsignadaInsert(),
    project: makeActiveProject(),
    crew: makeCrew({ deletedAt: "2026-07-01T00:00:00.000Z" }),
  })
  assert.equal(result.ok, false)
})

test("hardening: API start sin acceso módulo Obras → rechazada", () => {
  assert.equal(
    canAccessObrasModuleForStart({
      systemRole: "operario",
      roleCode: "operario",
      moduleVisibility: createEmptyModuleVisibility(),
    }),
    false
  )
})

test("hardening: API start con acceso módulo Obras → permitida", () => {
  assert.equal(
    canAccessObrasModuleForStart({
      systemRole: "supervisor",
      roleCode: "supervisor",
      moduleVisibility: createFullModuleVisibility(),
    }),
    true
  )
  assert.equal(
    canAccessObrasModuleForStart({
      systemRole: "administrador",
      roleCode: "administrador",
      moduleVisibility: createEmptyModuleVisibility(),
    }),
    true
  )
})

test("hardening: OT normal sin project_id no usa excepción asignada", () => {
  const result = validateObraTaskInsertIntegrity({
    task: {
      companyId: COMPANY_A,
      projectId: null,
      crewId: CREW_A,
      status: "asignada",
    },
  })
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.match(result.message, /programada/i)
  }
})

test("hardening: migración exige project same-tenant active y crew same-tenant", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8")

  assert.match(sql, /p\.company_id = NEW\.company_id/)
  assert.match(sql, /p\.deleted_at IS NULL/)
  assert.match(sql, /p\.status = 'active'::public\.project_status/)
  assert.match(sql, /c\.company_id = NEW\.company_id/)
  assert.match(sql, /c\.deleted_at IS NULL/)
  assert.match(sql, /NEW\.project_id IS NOT NULL AND NEW\.crew_id IS NOT NULL/)
  assert.doesNotMatch(sql, /GRANT EXECUTE[\s\S]*TO authenticated/)
  assert.doesNotMatch(sql, /CREATE POLICY/)
})

test("hotfix: obra active + cliente envía programada → fuerza asignada", () => {
  const result = validateObraTaskInsertIntegrity({
    task: makeAsignadaInsert({ status: "programada" }),
    project: makeActiveProject(),
    crew: makeCrew(),
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.status, "asignada")
  }
})

test("hotfix: obra active + cliente envía asignada → queda asignada", () => {
  const result = validateObraTaskInsertIntegrity({
    task: makeAsignadaInsert({ status: "asignada" }),
    project: makeActiveProject(),
    crew: makeCrew(),
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.status, "asignada")
  }
})

test("hotfix: obra planned + tarea nueva → mantiene programada", () => {
  const result = validateObraTaskInsertIntegrity({
    task: makeAsignadaInsert({ status: "programada" }),
    project: makeActiveProject({ status: "planned" }),
    crew: makeCrew(),
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.status, "programada")
  }
})

test("hotfix: obra reabierta closed→active + nueva tarea → asignada", () => {
  const reopened = makeActiveProject({ status: "active" })
  const clientStatus = resolveProjectTaskCreateStatus(reopened.status)
  assert.equal(clientStatus, "asignada")

  const evenIfClientSendsProgramada = validateObraTaskInsertIntegrity({
    task: makeAsignadaInsert({ status: "programada" }),
    project: reopened,
    crew: makeCrew(),
  })
  assert.equal(evenIfClientSendsProgramada.ok, true)
  if (evenIfClientSendsProgramada.ok) {
    assert.equal(evenIfClientSendsProgramada.status, "asignada")
  }
})

test("hotfix: UI tasks-tab resolve + DB force alineados en obra active", () => {
  const projectStatus = "active"
  const uiStatus = resolveProjectTaskCreateStatus(projectStatus)
  assert.equal(uiStatus, "asignada")

  const dbEffective = validateObraTaskInsertIntegrity({
    task: makeAsignadaInsert({ status: uiStatus }),
    project: makeActiveProject({ status: projectStatus }),
    crew: makeCrew(),
  })
  assert.equal(dbEffective.ok, true)
  if (dbEffective.ok) {
    assert.equal(dbEffective.status, "asignada")
  }

  const dbForceFromWrongClient = validateObraTaskInsertIntegrity({
    task: makeAsignadaInsert({ status: "programada" }),
    project: makeActiveProject({ status: projectStatus }),
    crew: makeCrew(),
  })
  assert.equal(dbForceFromWrongClient.ok, true)
  if (dbForceFromWrongClient.ok) {
    assert.equal(dbForceFromWrongClient.status, "asignada")
  }
})

test("hotfix: migración fuerza NEW.status := asignada en obra active", () => {
  const sql = readFileSync(HOTFIX_MIGRATION_PATH, "utf8")

  assert.match(sql, /NEW\.status := 'asignada'::public\.task_status/)
  assert.match(sql, /v_project_status = 'active'::public\.project_status/)
  assert.match(sql, /p\.company_id = NEW\.company_id/)
  assert.match(sql, /p\.deleted_at IS NULL/)
  assert.match(sql, /c\.company_id = NEW\.company_id/)
  assert.match(sql, /c\.deleted_at IS NULL/)
  assert.doesNotMatch(sql, /CREATE POLICY/)
  assert.doesNotMatch(sql, /GRANT EXECUTE/)
  assert.doesNotMatch(sql, /start_project_operational_dispatch/)
})

test("hotfix: migración original 20261001000100 no fue modificada por este hotfix", () => {
  const original = readFileSync(MIGRATION_PATH, "utf8")
  assert.doesNotMatch(original, /NEW\.status := 'asignada'/)
  assert.match(original, /start_project_operational_dispatch/)
})
