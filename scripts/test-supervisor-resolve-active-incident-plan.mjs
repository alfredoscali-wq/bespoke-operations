import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  buildIncidentResolveSupervisorActionMetadata,
  INCIDENT_SUPERVISOR_ACTIONS,
} from "../lib/audit/incidents-audit.shared.ts"
import {
  buildSupervisorResolveActiveIncidentPlan,
  buildTaskAfterResolve,
  isProtectedEnCursoToProgramadaTransitionAllowed,
  normalizeSupervisorResolveAction,
  SUPERVISOR_RESOLVE_ACTIONS,
  validateSupervisorResolveActiveIncidentPreconditions,
  validateSupervisorResolveActiveIncidentRequest,
} from "../lib/operations/incidents/supervisor-resolve-active-incident-plan.ts"
import { OPERATIONAL_CHECKLIST_RESPONSES_KEY } from "../lib/tasks/operational-checklist-responses.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationPath = join(
  __dirname,
  "../supabase/migrations/20260922000100_supervisor_resolve_active_task_incident.sql"
)

function buildTask(overrides = {}) {
  return {
    id: "task-1",
    code: "OT-1",
    title: "Instalación",
    description: "",
    projectCode: "P1",
    projectName: "Proyecto",
    type: "instalacion",
    priority: "media",
    status: "en-curso",
    dueDate: "2026-07-10",
    startDate: "2026-07-10",
    scheduledTime: "09:00:00",
    crewId: "crew-a",
    crew: "Cuadrilla A",
    dispatchOrder: 2,
    executionOrder: null,
    taskMetadata: {
      [OPERATIONAL_CHECKLIST_RESPONSES_KEY]: {
        item1: { confirmed: true },
      },
      preservedFlag: true,
    },
    createdAt: "2026-07-01T10:00:00.000Z",
    ...overrides,
  }
}

function buildIncident(overrides = {}) {
  return {
    id: "incident-1",
    companyId: "company-a",
    taskId: "task-1",
    status: "EN_ANALISIS",
    ...overrides,
  }
}

test("validateSupervisorResolveActiveIncidentRequest rechaza action inválida", () => {
  const result = validateSupervisorResolveActiveIncidentRequest({
    action: "invalid",
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.code, "VALIDATION")
  }
})

test("validateSupervisorResolveActiveIncidentRequest rechaza continue sin mensaje", () => {
  const result = validateSupervisorResolveActiveIncidentRequest({
    action: "continue",
  })

  assert.equal(result.ok, false)
})

test("validateSupervisorResolveActiveIncidentRequest rechaza reprogram sin motivo", () => {
  const result = validateSupervisorResolveActiveIncidentRequest({
    action: "reprogram",
  })

  assert.equal(result.ok, false)
})

test("validateSupervisorResolveActiveIncidentRequest rechaza cancel sin motivo", () => {
  const result = validateSupervisorResolveActiveIncidentRequest({
    action: "cancel",
  })

  assert.equal(result.ok, false)
})

test("validateSupervisorResolveActiveIncidentPreconditions rechaza incidencia no activa", () => {
  const result = validateSupervisorResolveActiveIncidentPreconditions({
    canSupervise: true,
    task: buildTask(),
    incident: buildIncident({ status: "RESUELTA" }),
    companyId: "company-a",
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.code, "INVALID_INCIDENT")
  }
})

test("validateSupervisorResolveActiveIncidentPreconditions rechaza OT no en-curso", () => {
  const result = validateSupervisorResolveActiveIncidentPreconditions({
    canSupervise: true,
    task: buildTask({ status: "asignada" }),
    incident: buildIncident(),
    companyId: "company-a",
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.code, "INVALID_STATUS")
  }
})

test("validateSupervisorResolveActiveIncidentPreconditions rechaza tenant incorrecto", () => {
  const result = validateSupervisorResolveActiveIncidentPreconditions({
    canSupervise: true,
    task: buildTask(),
    incident: buildIncident({ companyId: "company-b" }),
    companyId: "company-a",
  })

  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.code, "INVALID_INCIDENT")
  }
})

test("continue mantiene OT en-curso y no toca dispatch", () => {
  const request = validateSupervisorResolveActiveIncidentRequest({
    action: "continue",
    message: "Continuar ejecución",
  })

  assert.equal("ok" in request, false)
  const plan = buildSupervisorResolveActiveIncidentPlan({
    task: buildTask(),
    request,
  })

  assert.equal(plan.action, "continue")
  assert.equal(plan.targetTaskStatus, "en-curso")
  assert.equal(plan.incidentEventType, "CONTINUE")
  assert.deepEqual(plan.preDispatchClears, [])

  const after = buildTaskAfterResolve({ before: buildTask(), plan })
  assert.equal(after.status, "en-curso")
  assert.equal(after.dispatchOrder, 2)
})

test("reprogram mueve OT a programada y limpia asignación operativa", () => {
  const request = validateSupervisorResolveActiveIncidentRequest({
    action: "reprogram",
    reason: "Requiere replanificación administrativa",
  })

  assert.equal("ok" in request, false)
  const plan = buildSupervisorResolveActiveIncidentPlan({
    task: buildTask(),
    request,
  })

  assert.equal(plan.targetTaskStatus, "programada")
  assert.equal(plan.incidentEventType, "RESCHEDULE")
  assert.equal(plan.preDispatchClears.length, 1)
  assert.equal(plan.preDispatchClears[0]?.dispatch_order, null)

  const after = buildTaskAfterResolve({ before: buildTask(), plan })
  assert.equal(after.status, "programada")
  assert.equal(after.dueDate, "2026-07-10")
  assert.equal(after.startDate, "2026-07-10")
  assert.equal(after.crewId, undefined)
  assert.equal(after.scheduledTime, undefined)
  assert.equal(after.executionOrder, null)
  assert.equal(after.dispatchOrder, null)
})

test("reprogram resetea checklist y preserva metadata restante", () => {
  const request = validateSupervisorResolveActiveIncidentRequest({
    action: "reprogram",
    reason: "Motivo operativo",
  })

  assert.equal("ok" in request, false)
  const plan = buildSupervisorResolveActiveIncidentPlan({
    task: buildTask(),
    request,
  })

  assert.equal(
    plan.taskMetadata?.[OPERATIONAL_CHECKLIST_RESPONSES_KEY],
    undefined
  )
  assert.equal(plan.taskMetadata?.preservedFlag, true)
})

test("cancel mueve OT a cancelada y conserva checklist", () => {
  const request = validateSupervisorResolveActiveIncidentRequest({
    action: "cancel",
    reason: "Cliente rechazó",
  })

  assert.equal("ok" in request, false)
  const plan = buildSupervisorResolveActiveIncidentPlan({
    task: buildTask(),
    request,
  })

  assert.equal(plan.targetTaskStatus, "cancelada")
  assert.equal(plan.incidentEventType, "CANCEL_TASK")
  assert.equal(plan.cancellationReason, "otro")
  assert.equal(plan.cancellationObservation, "Cliente rechazó")
  assert.equal(plan.preDispatchClears.length, 1)

  const after = buildTaskAfterResolve({ before: buildTask(), plan })
  assert.equal(after.status, "cancelada")
  assert.equal(
    after.taskMetadata?.[OPERATIONAL_CHECKLIST_RESPONSES_KEY]?.item1?.confirmed,
    true
  )
})

test("transición en-curso → programada requiere contexto protegido", () => {
  assert.equal(isProtectedEnCursoToProgramadaTransitionAllowed(null), false)
  assert.equal(isProtectedEnCursoToProgramadaTransitionAllowed("off"), false)
  assert.equal(isProtectedEnCursoToProgramadaTransitionAllowed("on"), true)
})

test("auditoría resolve genera metadata RESUELTA para cancel", () => {
  const metadata = buildIncidentResolveSupervisorActionMetadata({
    base: {
      incidentId: "incident-1",
      taskId: "task-1",
      taskCode: "OT-1",
      incidentTypeId: "type-1",
    },
    action: "cancel",
    previousIncidentStatus: "EN_ANALISIS",
    actorEmployeeId: "employee-1",
    actorName: "Supervisor",
    reason: "Cancelar OT",
    previousTaskStatus: "en-curso",
    nextTaskStatus: "cancelada",
  })

  assert.equal(metadata.nextIncidentStatus, "RESUELTA")
  assert.equal(metadata.action, "cancel")
  assert.equal(metadata.reason, "Cancelar OT")
})

test("auditoría resolve no usa REPROGRAM como RESCHEDULE legacy", () => {
  assert.notEqual(
    INCIDENT_SUPERVISOR_ACTIONS.REPROGRAM,
    INCIDENT_SUPERVISOR_ACTIONS.RESCHEDULE
  )
})

test("normalizeSupervisorResolveAction acepta acciones válidas", () => {
  assert.equal(
    normalizeSupervisorResolveAction("continue"),
    SUPERVISOR_RESOLVE_ACTIONS.CONTINUE
  )
  assert.equal(
    normalizeSupervisorResolveAction(" REPROGRAM "),
    SUPERVISOR_RESOLVE_ACTIONS.REPROGRAM
  )
})

test("migración RC3.2.1 restringe RPC a service_role y protege transición", () => {
  const sql = readFileSync(migrationPath, "utf8")

  assert.match(sql, /supervisor_resolve_active_task_incident/)
  assert.match(sql, /SECURITY DEFINER/)
  assert.match(sql, /SET search_path = public/)
  assert.match(sql, /app\.supervisor_resolve_active_incident/)
  assert.match(sql, /REVOKE EXECUTE[\s\S]*FROM anon/)
  assert.match(sql, /REVOKE EXECUTE[\s\S]*FROM authenticated/)
  assert.match(sql, /GRANT EXECUTE[\s\S]*TO service_role/)
  assert.match(sql, /FOR UPDATE/)
  assert.doesNotMatch(
    sql,
    /app\.supervisor_reschedule_active_incident[\s\S]*asignada/
  )
})
