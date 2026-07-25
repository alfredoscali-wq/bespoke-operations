import assert from "node:assert/strict"
import test from "node:test"

import { ACTIVITY_ACTIONS } from "../lib/activity-engine/activity-actions.ts"
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_IMPACTS,
} from "../lib/activity-engine/activity-types.ts"
import { normalizeActivityRecordInput } from "../lib/activity-engine/activity-validate.ts"
import {
  buildCaseClosedActivity,
  buildCaseCreatedActivity,
  buildDerivationCreatedActivity,
  buildNoteCreatedActivity,
  isCustomerServiceDerivationNextStep,
  resolveDerivationAreas,
} from "../lib/customer-atenciones/customer-activity-events.ts"

test("1.1B: CASE_CREATED / CASE_CLOSED están en catálogo", () => {
  assert.equal(ACTIVITY_ACTIONS.CASE_CREATED, "CASE_CREATED")
  assert.equal(ACTIVITY_ACTIONS.CASE_CLOSED, "CASE_CLOSED")
})

test("1.1B: title/description se fusionan en metadata", () => {
  const normalized = normalizeActivityRecordInput({
    companyId: "11111111-1111-4111-8111-111111111111",
    module: "customer_service",
    entityType: "customer_atencion",
    entityId: "33333333-3333-4333-8333-333333333333",
    action: ACTIVITY_ACTIONS.NOTE_CREATED,
    category: ACTIVITY_CATEGORIES.COMMUNICATION,
    impact: ACTIVITY_IMPACTS.ACTIVITY,
    origin: "USER",
    title: "Nota registrada",
    description: "Se agregó una nota al expediente.",
    metadata: { longitud: 10 },
  })

  assert.equal(normalized.title, "Nota registrada")
  assert.equal(normalized.metadata?.title, "Nota registrada")
  assert.equal(normalized.metadata?.description, "Se agregó una nota al expediente.")
  assert.equal(normalized.metadata?.longitud, 10)
})

test("1.1B: builders de Customer Service", () => {
  const created = buildCaseCreatedActivity({
    customerId: "c1",
    motivo: "baja",
    canal: "telefono",
    estadoInicial: "para_resolver",
  })
  assert.equal(created.action, ACTIVITY_ACTIONS.CASE_CREATED)
  assert.equal(created.metadata.customer_id, "c1")

  const note = buildNoteCreatedActivity({ length: 42, hasAttachments: false })
  assert.equal(note.action, ACTIVITY_ACTIONS.NOTE_CREATED)
  assert.equal(note.metadata.longitud, 42)
  assert.equal(note.metadata.tiene_adjuntos, false)

  const closed = buildCaseClosedActivity({
    resultado: "resuelta",
    motivoCierre: "OK",
  })
  assert.equal(closed.action, ACTIVITY_ACTIONS.CASE_CLOSED)
})

test("1.1B: derivaciones usan códigos, no labels hardcodeados", () => {
  assert.equal(
    isCustomerServiceDerivationNextStep("resolver_consulta_tecnica"),
    true
  )
  assert.equal(isCustomerServiceDerivationNextStep("esperar_cliente"), false)

  const areas = resolveDerivationAreas({
    previousNextStep: null,
    newNextStep: "contactar_cliente",
  })
  assert.ok(areas)
  assert.equal(areas?.fromArea, "atencion")
  assert.equal(areas?.toArea, "contactar_cliente")

  const payload = buildDerivationCreatedActivity({
    fromArea: "atencion",
    toArea: "derivar_admin_gestion",
    motivo: "Requiere gestión",
  })
  assert.equal(payload.action, ACTIVITY_ACTIONS.DERIVATION_CREATED)
  assert.equal(payload.metadata.to_area, "derivar_admin_gestion")
})
