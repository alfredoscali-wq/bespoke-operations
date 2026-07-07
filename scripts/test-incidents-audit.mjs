import assert from "node:assert/strict"
import test from "node:test"

import {
  buildIncidentClosedDescription,
  buildIncidentClosedMetadata,
  buildIncidentCreatedDescription,
  buildIncidentCreatedMetadata,
  buildIncidentSupervisorActionDescription,
  buildIncidentSupervisorActionMetadata,
  INCIDENT_SUPERVISOR_ACTIONS,
  mapIncidentEventTypeToSupervisorAction,
  resolveIncidentAuditDisplayDescription,
  resolveIncidentAuditEntityLabel,
  resolveSupervisorActionResultStatus,
  resolveTaskCodeFromTask,
  shouldRecordIncidentClosedAudit,
  shouldRecordIncidentSupervisorAudit,
} from "../lib/audit/incidents-audit.shared.ts"

const base = {
  incidentId: "11111111-1111-4111-8111-111111111111",
  taskId: "22222222-2222-4222-8222-222222222222",
  taskCode: "OT-1001",
  incidentTypeId: "33333333-3333-4333-8333-333333333333",
  incidentTypeLabel: "Falla técnica",
  incidentTypeCode: "FALLA_TECNICA",
}

test("INCIDENT_CREATED metadata incluye contexto mínimo persistente", () => {
  const metadata = buildIncidentCreatedMetadata({
    ...base,
    comment: "Sin energía",
    employeeId: "44444444-4444-4444-8444-444444444444",
    employeeName: "Juan Operario",
    crewId: "55555555-5555-4555-8555-555555555555",
    workTeamId: "66666666-6666-4666-8666-666666666666",
    mobileDeviceId: "77777777-7777-4777-8777-777777777777",
  })

  assert.equal(metadata.incidentId, base.incidentId)
  assert.equal(metadata.taskId, base.taskId)
  assert.equal(metadata.taskCode, base.taskCode)
  assert.equal(metadata.incidentTypeCode, base.incidentTypeCode)
  assert.equal(metadata.source, "mobile-field-agent")
  assert.equal(metadata.employeeName, "Juan Operario")
})

test("INCIDENT_CREATED description usa código visible de OT", () => {
  assert.equal(
    buildIncidentCreatedDescription("OT-1001"),
    "Incidencia reportada (OT-1001)."
  )
})

test("shouldRecordIncidentSupervisorAudit cubre acciones supervisor RC3.1", () => {
  assert.equal(shouldRecordIncidentSupervisorAudit("REQUEST_INFO"), true)
  assert.equal(shouldRecordIncidentSupervisorAudit("CONTINUE"), true)
  assert.equal(shouldRecordIncidentSupervisorAudit("RESCHEDULE"), true)
  assert.equal(shouldRecordIncidentSupervisorAudit("CANCEL_TASK"), true)
  assert.equal(shouldRecordIncidentSupervisorAudit("CLOSED"), false)
  assert.equal(shouldRecordIncidentSupervisorAudit("STATUS_CHANGED"), false)
})

test("mapIncidentEventTypeToSupervisorAction traduce eventos operativos", () => {
  assert.equal(
    mapIncidentEventTypeToSupervisorAction("REQUEST_INFO"),
    INCIDENT_SUPERVISOR_ACTIONS.REQUEST_INFO
  )
  assert.equal(
    mapIncidentEventTypeToSupervisorAction("CONTINUE"),
    INCIDENT_SUPERVISOR_ACTIONS.CONTINUE
  )
})

test("INCIDENT_SUPERVISOR_ACTION genera textos comprensibles en español", () => {
  assert.equal(
    buildIncidentSupervisorActionDescription(
      INCIDENT_SUPERVISOR_ACTIONS.REQUEST_INFO,
      "OT-1001"
    ),
    "Supervisor solicitó información (OT-1001)."
  )
  assert.equal(
    buildIncidentSupervisorActionDescription(
      INCIDENT_SUPERVISOR_ACTIONS.CONTINUE,
      "OT-1001"
    ),
    "Supervisor continuó la OT (OT-1001)."
  )
  assert.equal(
    buildIncidentSupervisorActionDescription(
      INCIDENT_SUPERVISOR_ACTIONS.RESCHEDULE,
      "OT-1001"
    ),
    "Supervisor replanificó la OT (OT-1001)."
  )
  assert.equal(
    buildIncidentSupervisorActionDescription(
      INCIDENT_SUPERVISOR_ACTIONS.CANCEL_TASK,
      "OT-1001"
    ),
    "Supervisor canceló la OT (OT-1001)."
  )
})

test("INCIDENT_SUPERVISOR_ACTION metadata conserva acción y estados", () => {
  const metadata = buildIncidentSupervisorActionMetadata({
    base,
    supervisorAction: INCIDENT_SUPERVISOR_ACTIONS.CONTINUE,
    previousIncidentStatus: "EN_ANALISIS",
    nextIncidentStatus: "RESUELTA",
    actorEmployeeId: "88888888-8888-4888-8888-888888888888",
    actorName: "Supervisor Demo",
    note: "Continuar ejecución",
  })

  assert.equal(metadata.supervisorAction, INCIDENT_SUPERVISOR_ACTIONS.CONTINUE)
  assert.equal(metadata.previousIncidentStatus, "EN_ANALISIS")
  assert.equal(metadata.nextIncidentStatus, "RESUELTA")
  assert.equal(metadata.actorName, "Supervisor Demo")
})

test("resolveSupervisorActionResultStatus modela cierre operativo sin duplicar CLOSED", () => {
  assert.equal(
    resolveSupervisorActionResultStatus(
      INCIDENT_SUPERVISOR_ACTIONS.CONTINUE,
      "EN_ANALISIS"
    ),
    "RESUELTA"
  )
  assert.equal(
    resolveSupervisorActionResultStatus(
      INCIDENT_SUPERVISOR_ACTIONS.RESCHEDULE,
      "REPORTADA"
    ),
    "EN_ANALISIS"
  )
  assert.equal(
    resolveSupervisorActionResultStatus(
      INCIDENT_SUPERVISOR_ACTIONS.CANCEL_TASK,
      "EN_ANALISIS"
    ),
    "RECHAZADA"
  )
})

test("shouldRecordIncidentClosedAudit solo aplica a cierre explícito", () => {
  assert.equal(
    shouldRecordIncidentClosedAudit({
      auditExplicitClosure: true,
      status: "RESUELTA",
    }),
    true
  )
  assert.equal(
    shouldRecordIncidentClosedAudit({
      auditExplicitClosure: true,
      status: "RECHAZADA",
    }),
    true
  )
  assert.equal(
    shouldRecordIncidentClosedAudit({
      auditExplicitClosure: false,
      status: "RESUELTA",
    }),
    false
  )
  assert.equal(
    shouldRecordIncidentClosedAudit({
      auditExplicitClosure: true,
      status: "EN_ANALISIS",
    }),
    false
  )
})

test("INCIDENT_CLOSED metadata incluye resultado final", () => {
  const metadata = buildIncidentClosedMetadata({
    base,
    closureResult: "RECHAZADA",
    previousIncidentStatus: "EN_ANALISIS",
    actorEmployeeId: "88888888-8888-4888-8888-888888888888",
    actorName: "Supervisor Demo",
    note: "Incidencia cerrada como rechazada.",
  })

  assert.equal(metadata.closureResult, "RECHAZADA")
  assert.equal(metadata.taskCode, base.taskCode)
})

test("INCIDENT_CLOSED description diferencia resuelta y rechazada", () => {
  assert.equal(
    buildIncidentClosedDescription("RESUELTA", "OT-1001"),
    "Incidencia cerrada como resuelta (OT-1001)."
  )
  assert.equal(
    buildIncidentClosedDescription("RECHAZADA", "OT-1001"),
    "Incidencia cerrada como rechazada (OT-1001)."
  )
})

test("resolveIncidentAuditDisplayDescription sigue siendo comprensible sin entidad existente", () => {
  const description = resolveIncidentAuditDisplayDescription({
    action: "INCIDENT_SUPERVISOR_ACTION",
    description: "fallback",
    metadata: {
      supervisorAction: INCIDENT_SUPERVISOR_ACTIONS.RESCHEDULE,
      taskCode: "OT-1001",
    },
  })

  assert.equal(description, "Supervisor replanificó la OT (OT-1001).")
})

test("resolveIncidentAuditEntityLabel prioriza código visible de OT", () => {
  assert.equal(
    resolveIncidentAuditEntityLabel({
      taskCode: "OT-1001",
      incidentId: base.incidentId,
    }),
    "OT-1001"
  )
})

test("resolveTaskCodeFromTask reutiliza contrato visible de OT", () => {
  assert.equal(
    resolveTaskCodeFromTask({
      workOrderNumber: "WO-1",
      code: "OT-1",
      title: "Instalación",
    }),
    "WO-1"
  )
})

test("anti-duplicación: acciones operativas no usan INCIDENT_CLOSED", () => {
  for (const eventType of ["CONTINUE", "RESCHEDULE", "CANCEL_TASK"]) {
    assert.equal(shouldRecordIncidentSupervisorAudit(eventType), true)
    assert.equal(shouldRecordIncidentClosedAudit({ status: "RESUELTA" }), false)
  }
})
