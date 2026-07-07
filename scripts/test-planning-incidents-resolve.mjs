import assert from "node:assert/strict"
import test from "node:test"

import {
  buildPlanningIncidentResolvePayload,
  buildPlanningIncidentResolveSuccessMessage,
  LEGACY_PLANNING_INCIDENT_PRIMARY_ACTIONS,
  PLANNING_INCIDENT_RESOLVE_DECISIONS,
  PLANNING_INCIDENT_RESOLVE_PRIMARY_ACTION_LABEL,
  PLANNING_INCIDENT_TASK_CONTEXT_FIELDS,
  usesLegacyPlanningIncidentPrimaryActions,
} from "../lib/planificacion/planning-incidents-resolve.ts"

test("panel simplificado expone únicamente contexto OT reducido", () => {
  assert.deepEqual(PLANNING_INCIDENT_TASK_CONTEXT_FIELDS, [
    "taskCode",
    "workTitle",
    "customer",
    "status",
    "crew",
    "operator",
  ])
})

test("acción principal única es Resolver incidencia", () => {
  assert.equal(
    PLANNING_INCIDENT_RESOLVE_PRIMARY_ACTION_LABEL,
    "Resolver incidencia"
  )
})

test("Resolver incidencia ofrece tres decisiones", () => {
  assert.deepEqual(
    PLANNING_INCIDENT_RESOLVE_DECISIONS.map((decision) => decision.id),
    ["continue", "reprogram", "cancel"]
  )
  assert.deepEqual(
    PLANNING_INCIDENT_RESOLVE_DECISIONS.map((decision) => decision.label),
    ["Continuar OT", "Reprogramar OT", "Cancelar OT"]
  )
})

test("Continue exige mensaje obligatorio", () => {
  const invalid = buildPlanningIncidentResolvePayload({
    decision: "continue",
    message: "   ",
  })

  assert.equal(invalid.ok, false)

  const valid = buildPlanningIncidentResolvePayload({
    decision: "continue",
    message: "Continuar con precaución",
  })

  assert.deepEqual(valid, {
    ok: true,
    payload: {
      action: "continue",
      message: "Continuar con precaución",
    },
  })
})

test("Reprogram exige motivo obligatorio", () => {
  const invalid = buildPlanningIncidentResolvePayload({
    decision: "reprogram",
    reason: "",
  })

  assert.equal(invalid.ok, false)

  const valid = buildPlanningIncidentResolvePayload({
    decision: "reprogram",
    reason: "Cliente solicitó replanificar",
  })

  assert.deepEqual(valid, {
    ok: true,
    payload: {
      action: "reprogram",
      reason: "Cliente solicitó replanificar",
    },
  })
})

test("Cancel exige motivo obligatorio", () => {
  const invalid = buildPlanningIncidentResolvePayload({
    decision: "cancel",
    reason: " ",
  })

  assert.equal(invalid.ok, false)

  const valid = buildPlanningIncidentResolvePayload({
    decision: "cancel",
    reason: "Cliente rechazó el trabajo",
  })

  assert.deepEqual(valid, {
    ok: true,
    payload: {
      action: "cancel",
      reason: "Cliente rechazó el trabajo",
    },
  })
})

test("payload correcto para endpoint /resolve", () => {
  const continuePayload = buildPlanningIncidentResolvePayload({
    decision: "continue",
    message: "Seguir ejecución",
  })

  if (!continuePayload.ok) {
    assert.fail("continue payload inválido")
  }

  assert.equal(continuePayload.payload.action, "continue")
  assert.equal("message" in continuePayload.payload, true)
  assert.equal("reason" in continuePayload.payload, false)

  const reprogramPayload = buildPlanningIncidentResolvePayload({
    decision: "reprogram",
    reason: "Material insuficiente",
  })

  if (!reprogramPayload.ok) {
    assert.fail("reprogram payload inválido")
  }

  assert.equal(reprogramPayload.payload.action, "reprogram")
  assert.equal(reprogramPayload.payload.reason, "Material insuficiente")
})

test("acciones legacy principales ya no forman parte del flujo nuevo", () => {
  const currentPrimaryActions = [PLANNING_INCIDENT_RESOLVE_PRIMARY_ACTION_LABEL]

  assert.equal(
    usesLegacyPlanningIncidentPrimaryActions(currentPrimaryActions),
    false
  )
  assert.equal(
    usesLegacyPlanningIncidentPrimaryActions(
      LEGACY_PLANNING_INCIDENT_PRIMARY_ACTIONS
    ),
    true
  )
})

test("mensajes de éxito distinguen cada decisión", () => {
  assert.match(
    buildPlanningIncidentResolveSuccessMessage("continue"),
    /continúa en ejecución/i
  )
  assert.match(
    buildPlanningIncidentResolveSuccessMessage("reprogram"),
    /Administración/i
  )
  assert.match(
    buildPlanningIncidentResolveSuccessMessage("cancel"),
    /cancelada/i
  )
})
