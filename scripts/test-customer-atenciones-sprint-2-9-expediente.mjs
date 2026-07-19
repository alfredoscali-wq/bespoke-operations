import assert from "node:assert/strict"
import test from "node:test"

import {
  buildConsultationSituationSummary,
  buildConsultationTimelineCards,
  formatConsultationExpedienteAreaLabel,
  getConsultationExpedienteAreaForNextStep,
  getInterveningAreaForEvent,
  getResponsibleAreaForAtencion,
} from "../lib/customer-atenciones/consultation-expediente.ts"
import { formatCustomerAtencionEventActionLabel } from "../lib/customer-atenciones/format.ts"
import { mapCustomerAtencionEventRowToCustomerAtencionEvent } from "../lib/supabase/customer-atencion-events.mapper.ts"

test("área responsable: seguimiento → Atención al Cliente", () => {
  const area = getConsultationExpedienteAreaForNextStep("seguimiento_cliente")
  assert.equal(area.label, "Atención al Cliente")
  assert.equal(
    formatConsultationExpedienteAreaLabel(area),
    "👤 Atención al Cliente"
  )
})

test("área responsable: técnica / admin / ventas", () => {
  assert.equal(
    getConsultationExpedienteAreaForNextStep("resolver_consulta_tecnica").label,
    "Área Técnica"
  )
  assert.equal(
    getConsultationExpedienteAreaForNextStep("derivar_admin_facturacion").label,
    "Administración"
  )
  assert.equal(
    getConsultationExpedienteAreaForNextStep("contactar_cliente").label,
    "Ventas"
  )
})

test("consulta resuelta no tiene área responsable", () => {
  assert.equal(
    getResponsibleAreaForAtencion({
      status: "resuelta",
      nextStep: null,
    }),
    null
  )
})

test("intervención técnica se deduce del próximo paso anterior", () => {
  const area = getInterveningAreaForEvent({
    actionType: "consulta_pendiente",
    previousNextStep: "resolver_consulta_tecnica",
    newNextStep: "seguimiento_cliente",
  })

  assert.equal(area.label, "Área Técnica")
  assert.equal(formatConsultationExpedienteAreaLabel(area), "🛠 Área Técnica")
})

test("labels de acciones del expediente", () => {
  assert.equal(
    formatCustomerAtencionEventActionLabel("consulta_creada"),
    "Creación de la consulta"
  )
  assert.equal(
    formatCustomerAtencionEventActionLabel("consulta_ot_vinculada"),
    "Vinculación con OT"
  )
  assert.equal(
    formatCustomerAtencionEventActionLabel("consulta_pendiente"),
    "Consulta pendiente / devolución"
  )
})

test("mapper reconoce consulta_ot_vinculada", () => {
  const mapped = mapCustomerAtencionEventRowToCustomerAtencionEvent({
    id: "event-ot",
    company_id: "company-1",
    customer_atencion_id: "atencion-1",
    employee_id: "employee-1",
    action_type: "consulta_ot_vinculada",
    detail: "OT vinculada: OT-10",
    previous_status: "pendiente",
    new_status: "pendiente",
    previous_next_step: "generar_ot",
    new_next_step: "generar_ot",
    created_at: "2026-07-14T12:00:00.000Z",
  })

  assert.equal(mapped.actionType, "consulta_ot_vinculada")
})

test("situación actual usa estado vigente y último comentario del historial", () => {
  const summary = buildConsultationSituationSummary(
    {
      status: "para_resolver",
      nextStep: "seguimiento_cliente",
      updatedAt: "2026-07-14T12:40:00.000Z",
      resolution: null,
    },
    [
      {
        id: "e1",
        companyId: "c1",
        customerAtencionId: "a1",
        employeeId: "emp-1",
        actionType: "consulta_creada",
        detail: null,
        previousStatus: null,
        newStatus: "nueva",
        previousNextStep: null,
        newNextStep: null,
        createdAt: "2026-07-14T09:00:00.000Z",
      },
      {
        id: "e2",
        companyId: "c1",
        customerAtencionId: "a1",
        employeeId: "emp-2",
        actionType: "consulta_pendiente",
        detail:
          "Se realizó reinicio remoto.\nSolicitar al cliente reiniciar el router.",
        previousStatus: "en_gestion",
        newStatus: "para_resolver",
        previousNextStep: "resolver_consulta_tecnica",
        newNextStep: "seguimiento_cliente",
        createdAt: "2026-07-14T12:35:00.000Z",
      },
    ]
  )

  assert.equal(summary.statusLabel, "Para resolver")
  assert.equal(summary.responsibleAreaLabel, "Atención al Cliente")
  assert.equal(summary.managementTypeLabel, "Contacto con el cliente")
  assert.equal(summary.situationLabel, "Pendiente de contactar al cliente")
  assert.equal(summary.nextStepLabel, "Pendiente de contactar al cliente")
  assert.equal(summary.lastInterventionAreaLabel, "Área Técnica")
  assert.equal(summary.lastActorEmployeeId, "emp-2")
  assert.match(summary.lastComment ?? "", /reinicio remoto/)
  assert.match(summary.lastComment ?? "", /\n/)
})

test("timeline omite gestion_iniciada (RC 3.1.4)", () => {
  const cards = buildConsultationTimelineCards([
    {
      id: "e1",
      companyId: "c1",
      customerAtencionId: "a1",
      employeeId: "emp-1",
      actionType: "consulta_creada",
      detail: null,
      previousStatus: null,
      newStatus: "nueva",
      previousNextStep: null,
      newNextStep: null,
      createdAt: "2026-07-14T09:00:00.000Z",
    },
    {
      id: "e2",
      companyId: "c1",
      customerAtencionId: "a1",
      employeeId: "emp-1",
      actionType: "gestion_iniciada",
      detail: null,
      previousStatus: "para_resolver",
      newStatus: "en_gestion",
      previousNextStep: "seguimiento_cliente",
      newNextStep: "seguimiento_cliente",
      createdAt: "2026-07-14T09:05:00.000Z",
    },
    {
      id: "e3",
      companyId: "c1",
      customerAtencionId: "a1",
      employeeId: "emp-1",
      actionType: "consulta_resuelta",
      detail: "Cliente conforme",
      previousStatus: "en_gestion",
      newStatus: "resuelta",
      previousNextStep: "seguimiento_cliente",
      newNextStep: null,
      createdAt: "2026-07-14T10:00:00.000Z",
    },
  ])

  assert.equal(cards.length, 2)
  assert.equal(cards[0]?.id, "e1")
  assert.equal(cards[1]?.id, "e3")
  assert.ok(!cards.some((card) => card.eventTitle.includes("INICIO")))
})

test("timeline conserva comentarios y orden cronológico ASC", () => {
  const cards = buildConsultationTimelineCards([
    {
      id: "e1",
      companyId: "c1",
      customerAtencionId: "a1",
      employeeId: "emp-1",
      actionType: "consulta_creada",
      detail: null,
      previousStatus: null,
      newStatus: "nueva",
      previousNextStep: null,
      newNextStep: null,
      createdAt: "2026-07-14T09:00:00.000Z",
    },
    {
      id: "e2",
      companyId: "c1",
      customerAtencionId: "a1",
      employeeId: "emp-2",
      actionType: "consulta_pendiente",
      detail: "Comentario técnico completo\nsegunda línea",
      previousStatus: "en_gestion",
      newStatus: "para_resolver",
      previousNextStep: "resolver_consulta_tecnica",
      newNextStep: "seguimiento_cliente",
      createdAt: "2026-07-14T12:35:00.000Z",
    },
  ])

  assert.equal(cards.length, 2)
  assert.equal(cards[0]?.id, "e1")
  assert.equal(cards[1]?.id, "e2")
  assert.equal(cards[0]?.actionLabel, "Creación de la consulta")
  assert.equal(cards[0]?.narrativeLead, "creó la consulta.")
  assert.equal(cards[1]?.comment, "Comentario técnico completo\nsegunda línea")
  assert.equal(cards[1]?.commentLabel, "Resultado de esa gestión")
  assert.equal(cards[1]?.previousStatusLabel, "En gestión")
  assert.equal(cards[1]?.newStatusLabel, "Para resolver")
  assert.equal(cards[1]?.previousNextStepLabel, "Resolver consulta técnica")
  assert.equal(cards[1]?.newNextStepLabel, "Requiere contacto con el cliente")
  assert.equal(cards[1]?.areaLabel, "Área Técnica")
  assert.match(cards[1]?.closingNote ?? "", /Atención al Cliente/)
})
