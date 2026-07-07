import assert from "node:assert/strict"
import test from "node:test"

import {
  buildContinueIncidentSupervisorPlan,
  countActiveTaskIncidentsForMetrics,
  diagnoseSupervisorRescheduleFromTaskStatus,
} from "../lib/planificacion/planning-incidents-supervisor-actions.ts"

test("Continuar RC3.1 no modifica tasks.status", () => {
  const plan = buildContinueIncidentSupervisorPlan()

  assert.equal(plan.modifiesTaskStatus, false)
  assert.equal(plan.incidentEventType, "CONTINUE")
  assert.equal(plan.nextIncidentStatus, "RESUELTA")
  assert.equal(plan.canContinue, true)
})

test("Replanificar desde en-curso usa flujo RC3.1 protegido", () => {
  const diagnosis = diagnoseSupervisorRescheduleFromTaskStatus("en-curso")

  assert.deepEqual(diagnosis, {
    allowed: true,
    workflowAction: "reschedule-from-active-incident",
  })
})

test("Replanificar legacy incidencia reutiliza reschedule-from-incident", () => {
  const diagnosis = diagnoseSupervisorRescheduleFromTaskStatus("incidencia")

  assert.deepEqual(diagnosis, {
    allowed: true,
    workflowAction: "reschedule-from-incident",
  })
})

test("Replanificar vencida reutiliza reschedule-from-overdue", () => {
  const diagnosis = diagnoseSupervisorRescheduleFromTaskStatus("vencida")

  assert.deepEqual(diagnosis, {
    allowed: true,
    workflowAction: "reschedule-from-overdue",
  })
})

test("countActiveTaskIncidentsForMetrics ignora tasks.status incidencia legacy", () => {
  const activeIncidents = [
    { status: "REPORTADA", companyId: "company-a" },
    { status: "EN_ANALISIS", companyId: "company-a" },
  ]

  const legacyTaskStatusCount = 1
  const rc31Count = countActiveTaskIncidentsForMetrics(activeIncidents, "company-a")

  assert.notEqual(rc31Count, legacyTaskStatusCount)
  assert.equal(rc31Count, 2)
})

test("countActiveTaskIncidentsForMetrics filtra por company_id y status activo", () => {
  const count = countActiveTaskIncidentsForMetrics(
    [
      { status: "REPORTADA", companyId: "company-a" },
      { status: "EN_ANALISIS", companyId: "company-a" },
      { status: "RESUELTA", companyId: "company-a" },
      { status: "REPORTADA", companyId: "company-b" },
    ],
    "company-a"
  )

  assert.equal(count, 2)
})
