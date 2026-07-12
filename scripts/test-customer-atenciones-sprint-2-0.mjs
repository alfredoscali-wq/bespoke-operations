import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  deriveConsultationStatusFromHistoricalResultado,
  deriveConsultationStatusFromResultado,
  deriveNextStepForNewConsultation,
  isCustomerAtencionNextStep,
  isCustomerAtencionStatus,
} from "../lib/customer-atenciones/consultation.ts"
import {
  mapConsultaCreadaEventPayload,
  mapCreateCustomerAtencionEventPayloadToInsert,
  mapCustomerAtencionEventRowToCustomerAtencionEvent,
} from "../lib/supabase/customer-atencion-events.mapper.ts"
import {
  mapCreateCustomerAtencionPayloadToInsert,
  mapCustomerAtencionRowToCustomerAtencion,
} from "../lib/supabase/customer-atenciones.mapper.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationPath = join(
  __dirname,
  "../supabase/migrations/20261005000100_customer_atenciones_sprint_2_0.sql"
)
const migrationSql = readFileSync(migrationPath, "utf8")

const sprint1MigrationPath = join(
  __dirname,
  "../supabase/migrations/20260925000100_customer_atenciones_sprint_1_0.sql"
)
const retencionesMigrationPath = join(
  __dirname,
  "../supabase/migrations/20260927000100_customer_retenciones_sprint_3_0.sql"
)
const recuperacionesMigrationPath = join(
  __dirname,
  "../supabase/migrations/20260928000100_customer_recuperaciones_sprint_5_0.sql"
)
const seguimientosMigrationPath = join(
  __dirname,
  "../supabase/migrations/20260926000100_customer_seguimientos_sprint_2_0.sql"
)

const sampleAtencionRow = {
  id: "atencion-1",
  company_id: "company-1",
  customer_id: "customer-1",
  attended_by_employee_id: "employee-1",
  channel: "whatsapp",
  motivo: "consulta",
  detail: "Consulta por factura",
  resolution: "Se explicó el detalle de la factura",
  resultado: "resuelta",
  status: "resuelta",
  next_step: null,
  active_management_employee_id: null,
  active_management_started_at: null,
  created_at: "2026-07-08T12:00:00.000Z",
  updated_at: "2026-07-08T12:00:00.000Z",
  deleted_at: null,
}

test("1. estados válidos aceptados por migración", () => {
  assert.match(migrationSql, /customer_atenciones_status_check/)
  for (const status of [
    "nueva",
    "para_resolver",
    "en_gestion",
    "pendiente",
    "resuelta",
  ]) {
    assert.match(migrationSql, new RegExp(`'${status}'`))
  }
})

test("2. estados inválidos rechazados por CHECK constraint", () => {
  assert.match(migrationSql, /status IN \(/)
  assert.doesNotMatch(migrationSql, /'cerrada'/)
  assert.doesNotMatch(migrationSql, /'abierta'/)
})

test("3. próximo paso válido aceptado por migración", () => {
  assert.match(migrationSql, /customer_atenciones_next_step_check/)
  for (const step of [
    "realizar_retencion",
    "resolver_facturacion",
    "analizar_problema_tecnico",
    "contactar_cliente",
    "esperar_cliente",
    "esperar_administracion",
    "coordinar_retiro",
    "generar_ot",
  ]) {
    assert.match(migrationSql, new RegExp(`'${step}'`))
  }
})

test("4. próximo paso nullable", () => {
  assert.match(migrationSql, /next_step IS NULL/)
  assert.equal(deriveNextStepForNewConsultation("resuelta"), null)
  assert.equal(deriveNextStepForNewConsultation("requiere_seguimiento"), null)
})

test("5. backfill resuelta", () => {
  assert.match(
    migrationSql,
    /WHEN resultado IN \('resuelta', 'ot_creada'\) THEN 'resuelta'/
  )
  assert.equal(deriveConsultationStatusFromHistoricalResultado("resuelta"), "resuelta")
})

test("6. backfill ot_creada", () => {
  assert.equal(deriveConsultationStatusFromHistoricalResultado("ot_creada"), "resuelta")
})

test("7. backfill requiere_seguimiento", () => {
  assert.match(
    migrationSql,
    /WHEN resultado = 'requiere_seguimiento' THEN 'pendiente'/
  )
  assert.equal(
    deriveConsultationStatusFromHistoricalResultado("requiere_seguimiento"),
    "pendiente"
  )
})

test("8. gestión activa employee + timestamp emparejados", () => {
  assert.match(migrationSql, /active_management_employee_id/)
  assert.match(migrationSql, /active_management_started_at/)
  assert.match(migrationSql, /customer_atenciones_active_management_fields_check/)
})

test("9. integridad tenant customer_atenciones → customer", () => {
  assert.match(migrationSql, /enforce_customer_atenciones_tenant_integrity/)
  assert.match(migrationSql, /CUSTOMER_ATENCION_CUSTOMER_TENANT_MISMATCH/)
})

test("10. integridad tenant customer_atenciones → attended_by_employee", () => {
  assert.match(migrationSql, /CUSTOMER_ATENCION_ATTENDED_EMPLOYEE_TENANT_MISMATCH/)
})

test("11. integridad tenant evento → Consulta", () => {
  assert.match(migrationSql, /enforce_customer_atencion_events_tenant_integrity/)
  assert.match(migrationSql, /CUSTOMER_ATENCION_EVENT_ATENCION_TENANT_MISMATCH/)
})

test("12. integridad tenant evento → employee", () => {
  assert.match(migrationSql, /CUSTOMER_ATENCION_EVENT_EMPLOYEE_TENANT_MISMATCH/)
})

test("13. RLS eventos", () => {
  assert.match(migrationSql, /customer_atencion_events_select_policy/)
  assert.match(migrationSql, /customer_atencion_events_insert_policy/)
  assert.match(
    migrationSql,
    /auth_user_has_allowed_module\('atencion_cliente'\)/
  )
})

test("14. demo read-only en INSERT de eventos", () => {
  const insertPolicyMatch = migrationSql.match(
    /CREATE POLICY customer_atencion_events_insert_policy[\s\S]*?;/
  )
  assert.ok(insertPolicyMatch)
  assert.match(insertPolicyMatch[0], /auth_is_demo_platform_read_only\(\)/)
})

test("15. creación resuelta mantiene flujo actual", () => {
  const insert = mapCreateCustomerAtencionPayloadToInsert({
    companyId: "company-1",
    customerId: "customer-1",
    attendedByEmployeeId: "employee-1",
    channel: "telefono",
    motivo: "reclamo",
    detail: "Cliente reclama demora",
    resolution: "Se coordinó visita técnica",
    resultado: "resuelta",
  })

  assert.equal(insert.resultado, "resuelta")
  assert.equal(insert.status, "resuelta")
  assert.equal(insert.next_step, null)
  assert.equal(insert.active_management_employee_id, null)
  assert.equal(insert.active_management_started_at, null)
})

test("16. creación con seguimiento mantiene status pendiente", () => {
  const insert = mapCreateCustomerAtencionPayloadToInsert({
    companyId: "company-1",
    customerId: "customer-1",
    attendedByEmployeeId: "employee-1",
    channel: "telefono",
    motivo: "consulta",
    detail: "Requiere callback",
    resolution: "Se programó seguimiento",
    resultado: "requiere_seguimiento",
  })

  assert.equal(insert.resultado, "requiere_seguimiento")
  assert.equal(insert.status, "pendiente")
  assert.equal(deriveConsultationStatusFromResultado("requiere_seguimiento"), "pendiente")
})

test("17. evento consulta_creada vía trigger SQL", () => {
  assert.match(migrationSql, /customer_atenciones_record_consulta_creada_event/)
  assert.match(migrationSql, /'consulta_creada'/)
  assert.match(migrationSql, /AFTER INSERT ON public\.customer_atenciones/)
})

test("18. actor registrado en payload de evento", () => {
  const payload = mapConsultaCreadaEventPayload({
    companyId: "company-1",
    id: "atencion-1",
    attendedByEmployeeId: "employee-1",
    status: "resuelta",
    nextStep: null,
    createdAt: "2026-07-08T12:00:00.000Z",
  })

  assert.equal(payload.employeeId, "employee-1")
  assert.equal(payload.actionType, "consulta_creada")
  assert.equal(payload.newStatus, "resuelta")

  const insert = mapCreateCustomerAtencionEventPayloadToInsert(payload)
  assert.equal(insert.employee_id, "employee-1")
  assert.equal(insert.action_type, "consulta_creada")
})

test("19. lectura mapper de registros históricos", () => {
  const historical = mapCustomerAtencionRowToCustomerAtencion({
    ...sampleAtencionRow,
    resultado: "requiere_seguimiento",
    status: "pendiente",
  })

  assert.equal(historical.resultado, "requiere_seguimiento")
  assert.equal(historical.status, "pendiente")

  const otCreada = mapCustomerAtencionRowToCustomerAtencion({
    ...sampleAtencionRow,
    resultado: "ot_creada",
    status: "resuelta",
  })

  assert.equal(otCreada.resultado, "ot_creada")
  assert.equal(otCreada.status, "resuelta")
})

test("20. regresión retenciones — migración sprint 3.0 intacta", () => {
  const sql = readFileSync(retencionesMigrationPath, "utf8")
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.customer_retenciones/)
  assert.doesNotMatch(migrationSql, /customer_retenciones/)
})

test("21. regresión recuperaciones — migración sprint 5.0 intacta", () => {
  const sql = readFileSync(recuperacionesMigrationPath, "utf8")
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.customer_recuperaciones/)
  assert.doesNotMatch(migrationSql, /customer_recuperaciones/)
})

test("22. regresión agenda/seguimientos — migración sprint 2.0 seguimientos intacta", () => {
  const sql = readFileSync(seguimientosMigrationPath, "utf8")
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.customer_seguimientos/)
  assert.doesNotMatch(migrationSql, /customer_seguimientos/)
})

test("tipos de evento mínimos en migración", () => {
  for (const actionType of [
    "consulta_creada",
    "gestion_iniciada",
    "gestion_registrada",
    "consulta_pendiente",
    "consulta_resuelta",
    "proximo_paso_cambiado",
  ]) {
    assert.match(migrationSql, new RegExp(`'${actionType}'`))
  }
})

test("mapper de eventos normaliza fila", () => {
  const mapped = mapCustomerAtencionEventRowToCustomerAtencionEvent({
    id: "event-1",
    company_id: "company-1",
    customer_atencion_id: "atencion-1",
    employee_id: "employee-1",
    action_type: "consulta_creada",
    detail: null,
    previous_status: null,
    new_status: "resuelta",
    previous_next_step: null,
    new_next_step: null,
    created_at: "2026-07-08T12:00:00.000Z",
  })

  assert.equal(mapped.actionType, "consulta_creada")
  assert.equal(mapped.newStatus, "resuelta")
})

test("helpers de validación de catálogo", () => {
  assert.equal(isCustomerAtencionStatus("pendiente"), true)
  assert.equal(isCustomerAtencionStatus("invalid"), false)
  assert.equal(isCustomerAtencionNextStep("contactar_cliente"), true)
  assert.equal(isCustomerAtencionNextStep("invalid"), false)
})

test("migración sprint 1.0 histórica permanece intacta", () => {
  const sql = readFileSync(sprint1MigrationPath, "utf8")
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.customer_atenciones/)
  assert.doesNotMatch(sql, /customer_atencion_events/)
})

test("resuelta exige next_step NULL en migración", () => {
  assert.match(migrationSql, /customer_atenciones_resuelta_next_step_check/)
})
