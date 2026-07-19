/**
 * RC 3.1 — management assistant copy + return detection.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  detectManagementAssistantReturn,
  getManagementAssistantNextStepMessage,
  getManagementAssistantOptionLabel,
  getManagementAssistantOptionsAfterTecnica,
  MANAGEMENT_ASSISTANT_INITIAL_OPTIONS,
} from "../lib/customer-atenciones/consultation-management-assistant.ts"

test("initial options exclude Generar OT", () => {
  assert.ok(!MANAGEMENT_ASSISTANT_INITIAL_OPTIONS.includes("link_ot"))
  assert.deepEqual(MANAGEMENT_ASSISTANT_INITIAL_OPTIONS, [
    "resolve",
    "esperar_cliente",
    "resolver_consulta_tecnica",
    "derivar_admin_gestion",
    "contactar_cliente",
    "realizar_retencion",
  ])
})

test("after tecnica includes OT only when next_step is generar_ot", () => {
  const withOt = getManagementAssistantOptionsAfterTecnica("generar_ot")
  assert.equal(withOt[0], "link_ot")
  assert.ok(withOt.includes("resolver_consulta_tecnica"))

  const withoutOt = getManagementAssistantOptionsAfterTecnica("seguimiento_cliente")
  assert.ok(!withoutOt.includes("link_ot"))
})

test("natural language labels and next-step previews", () => {
  assert.equal(
    getManagementAssistantOptionLabel("resolver_consulta_tecnica"),
    "Se envía al área Técnica."
  )
  assert.equal(
    getManagementAssistantOptionLabel("resolver_consulta_tecnica", {
      afterTecnica: true,
    }),
    "Solicitar una nueva revisión técnica."
  )
  assert.equal(
    getManagementAssistantNextStepMessage("realizar_retencion"),
    "Se iniciará el proceso de retención."
  )
})

test("detects tecnica return from consulta_pendiente", () => {
  const result = detectManagementAssistantReturn(
    { status: "para_resolver", nextStep: "generar_ot" },
    [
      {
        id: "e1",
        companyId: "c1",
        atencionId: "a1",
        employeeId: "u1",
        actionType: "consulta_pendiente",
        previousStatus: "en_gestion",
        newStatus: "para_resolver",
        previousNextStep: "resolver_consulta_tecnica",
        newNextStep: "generar_ot",
        detail: "Requiere visita técnica",
        createdAt: "2026-07-18T12:00:00.000Z",
      },
    ]
  )

  assert.ok(result)
  assert.equal(result?.kind, "tecnica")
  assert.equal(result?.headline, "El área Técnica finalizó el análisis.")
  assert.equal(result?.summary, "Requiere visita técnica")
})

test("no return banner while still in tecnica", () => {
  const result = detectManagementAssistantReturn(
    { status: "en_gestion", nextStep: "resolver_consulta_tecnica" },
    []
  )
  assert.equal(result, null)
})
