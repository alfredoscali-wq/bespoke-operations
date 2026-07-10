import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  mapCreateCustomerRetencionPayloadToInsert,
  mapCustomerRetencionRowToCustomerRetencion,
  mapDeriveCustomerRetencionToAdministrationPayloadToUpdate,
  mapFinalizeCustomerRetencionRetainedPayloadToUpdate,
  mapMarkCustomerRetencionReadyForRetiroPayloadToUpdate,
} from "../lib/supabase/customer-retenciones.mapper.ts"
import {
  canMarkCustomerRetencionReadyForRetiro,
  canViewAssignedCustomerRetenciones,
} from "../lib/customer-retenciones/access.ts"
import {
  ACTIVE_CUSTOMER_RETENCION_STATUSES,
  applyAssignedRetencionSupervisionView,
  filterAssignedRetenciones,
} from "../lib/customer-retenciones/supervision.ts"
import {
  countActiveRetencionesForEmployee,
  countBajasProcedidasInPeriod,
} from "../lib/supabase/customer-retenciones.queries.ts"
import { buildRetencionJornadaEntry } from "../lib/customer-seguimientos/jornada.ts"
import { buildEquipoIndividualReportKpis } from "../lib/atencion-cliente-equipo/report.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationPath = join(
  __dirname,
  "../supabase/migrations/20260929000100_customer_retenciones_sprint_6_0.sql"
)
const migrationSql = readFileSync(migrationPath, "utf8")

const sampleActiveRows = [
  {
    id: "r1",
    customerId: "c1",
    customerName: "Cliente A",
    assignedByEmployeeId: "e1",
    assignedByEmployeeName: "Ana",
    motivoBaja: "mudanza",
    detail: "Detalle",
    status: "en_gestion",
    resultado: null,
    resolution: null,
    createdAt: "2026-07-10T10:00:00.000Z",
  },
  {
    id: "r2",
    customerId: "c2",
    customerName: "Cliente B",
    assignedByEmployeeId: "e1",
    assignedByEmployeeName: "Ana",
    motivoBaja: "otro",
    detail: "Detalle",
    status: "pendiente_retiro",
    resultado: "persiste_baja",
    resolution: "Cliente insiste",
    createdAt: "2026-07-09T10:00:00.000Z",
  },
  {
    id: "r3",
    customerId: "c3",
    customerName: "Cliente C",
    assignedByEmployeeId: "e1",
    assignedByEmployeeName: "Ana",
    motivoBaja: "otro",
    detail: "Detalle",
    status: "pendiente_administracion",
    resultado: "persiste_baja",
    resolution: "Derivada",
    createdAt: "2026-07-08T10:00:00.000Z",
  },
]

test("migración evoluciona estados y resultado persiste_baja", () => {
  assert.match(migrationSql, /status IN \(\s*'en_gestion'/)
  assert.match(migrationSql, /'pendiente_administracion'/)
  assert.match(migrationSql, /'pendiente_retiro'/)
  assert.match(migrationSql, /'persiste_baja'/)
  assert.match(migrationSql, /UPDATE public\.customer_retenciones[\s\S]*pendiente[\s\S]*en_gestion/)
})

test("migración permite insert autoasignado por Atención al Cliente", () => {
  assert.match(migrationSql, /auth_can_create_customer_retencion\(\)/)
  assert.match(migrationSql, /assigned_employee_id = public\.auth_user_employee_id\(\)/)
  assert.match(migrationSql, /status = 'en_gestion'/)
})

test("migración autoriza update Admin pendiente_administracion → pendiente_retiro", () => {
  assert.match(migrationSql, /customer_retenciones_admin_update_policy/)
  assert.match(migrationSql, /status = 'pendiente_administracion'/)
  assert.match(migrationSql, /status = 'pendiente_retiro'/)
})

test("insert crea gestión en_gestion autoasignada", () => {
  const insert = mapCreateCustomerRetencionPayloadToInsert({
    companyId: "company-1",
    customerId: "customer-1",
    assignedEmployeeId: "employee-1",
    assignedByEmployeeId: "employee-1",
    motivoBaja: "mudanza",
    detail: "Cliente consulta baja",
  })

  assert.equal(insert.status, "en_gestion")
  assert.equal(insert.assigned_employee_id, insert.assigned_by_employee_id)
  assert.equal(insert.administration_pending_at, null)
})

test("transición en_gestion → finalizada + retenido", () => {
  const update = mapFinalizeCustomerRetencionRetainedPayloadToUpdate({
    status: "finalizada",
    resultado: "retenido",
    resolution: "Acuerdo alcanzado",
    completedAt: "2026-07-10T15:00:00.000Z",
    completedByEmployeeId: "employee-1",
  })

  assert.equal(update.status, "finalizada")
  assert.equal(update.resultado, "retenido")
  assert.equal(update.administration_pending_at, null)
})

test("transición en_gestion → pendiente_administracion + persiste_baja", () => {
  const update = mapDeriveCustomerRetencionToAdministrationPayloadToUpdate({
    status: "pendiente_administracion",
    resultado: "persiste_baja",
    resolution: "Cliente insiste con la baja",
    administrationPendingAt: "2026-07-10T16:00:00.000Z",
  })

  assert.equal(update.status, "pendiente_administracion")
  assert.equal(update.resultado, "persiste_baja")
  assert.equal(update.completed_at, null)
  assert.ok(update.administration_pending_at)
})

test("transición Admin marca listo para retiro", () => {
  const update = mapMarkCustomerRetencionReadyForRetiroPayloadToUpdate({
    status: "pendiente_retiro",
  })

  assert.deepEqual(update, { status: "pendiente_retiro" })
})

test("Admin puede marcar listo; AC no", () => {
  assert.equal(canMarkCustomerRetencionReadyForRetiro("administracion"), true)
  assert.equal(canMarkCustomerRetencionReadyForRetiro("atencion_cliente"), false)
  assert.equal(canViewAssignedCustomerRetenciones("atencion_cliente"), false)
})

test("legacy no_retenido sigue siendo válido en mapper", () => {
  const mapped = mapCustomerRetencionRowToCustomerRetencion({
    id: "legacy-1",
    company_id: "company-1",
    customer_id: "customer-1",
    assigned_employee_id: "employee-1",
    assigned_by_employee_id: "employee-2",
    motivo_baja: "otro",
    detail: "Histórico",
    status: "finalizada",
    resultado: "no_retenido",
    resolution: "Cierre anterior",
    completed_at: "2026-06-01T12:00:00.000Z",
    completed_by_employee_id: "employee-1",
    administration_pending_at: null,
    created_at: "2026-06-01T10:00:00.000Z",
    updated_at: "2026-06-01T12:00:00.000Z",
    deleted_at: null,
  })

  assert.equal(mapped.resultado, "no_retenido")
  assert.equal(mapped.status, "finalizada")
})

test("Mis Retenciones incluye en_gestion y pendiente_retiro", () => {
  const visible = sampleActiveRows.filter((row) =>
    ACTIVE_CUSTOMER_RETENCION_STATUSES.includes(row.status)
  )

  assert.deepEqual(visible.map((row) => row.id), ["r1", "r2"])
})

test("Mis Retenciones excluye pendiente_administracion", () => {
  const visible = sampleActiveRows.filter((row) =>
    ACTIVE_CUSTOMER_RETENCION_STATUSES.includes(row.status)
  )

  assert.equal(visible.some((row) => row.status === "pendiente_administracion"), false)
})

test("supervisión filtra nuevos estados", () => {
  const supervisionRows = sampleActiveRows.map((row) => ({
    ...row,
    assignedEmployeeId: "e1",
    assignedEmployeeName: "Ana",
    completedAt: null,
    administrationPendingAt: null,
  }))

  assert.equal(
    filterAssignedRetenciones(supervisionRows, "pendientes_administracion").length,
    1
  )
  assert.equal(
    filterAssignedRetenciones(supervisionRows, "pendientes_retiro").length,
    1
  )
  assert.equal(
    applyAssignedRetencionSupervisionView(supervisionRows, "finalizadas").length,
    0
  )
})

test("KPI activas usa estados accionables", () => {
  assert.deepEqual(ACTIVE_CUSTOMER_RETENCION_STATUSES, [
    "en_gestion",
    "pendiente_retiro",
  ])
  assert.equal(typeof countActiveRetencionesForEmployee, "function")
})

test("Mi Jornada incluye retenido y persiste_baja", () => {
  const retained = buildRetencionJornadaEntry({
    id: "r1",
    kind: "retencion",
    occurredAt: "2026-07-10T14:00:00.000Z",
    customerId: "c1",
    customerName: "Cliente",
    resultado: "retenido",
    resolution: "Acuerdo",
  })
  const derived = buildRetencionJornadaEntry({
    id: "r2",
    kind: "retencion",
    occurredAt: "2026-07-10T15:00:00.000Z",
    customerId: "c2",
    customerName: "Cliente 2",
    resultado: "persiste_baja",
    resolution: "Derivada a Admin",
  })

  assert.match(retained.detail, /Retenido/)
  assert.match(derived.detail, /Persiste con la baja/)
})

test("Reporte Individual calcula Bajas procedidas", () => {
  const bounds = {
    start: "2026-07-10T00:00:00.000Z",
    end: "2026-07-11T00:00:00.000Z",
  }

  const count = countBajasProcedidasInPeriod(
    [
      {
        resultado: "persiste_baja",
        completed_at: null,
        administration_pending_at: "2026-07-10T12:00:00.000Z",
      },
      {
        resultado: "no_retenido",
        completed_at: "2026-07-10T13:00:00.000Z",
        administration_pending_at: null,
      },
      {
        resultado: "retenido",
        completed_at: "2026-07-10T14:00:00.000Z",
        administration_pending_at: null,
      },
    ],
    bounds
  )

  assert.equal(count, 2)

  const kpis = buildEquipoIndividualReportKpis({
    atenciones: 0,
    atencionesResueltas: 0,
    seguimientosResueltos: 0,
    seguimientosCompletados: 0,
    seguimientosPendientes: 0,
    retencionesGestionadas: 2,
    clientesRetenidos: 1,
    bajasProcedidas: count,
    recuperosGestionados: 0,
    clientesRecuperados: 0,
  })

  assert.equal(kpis.clientesRetenidos, 1)
  assert.equal(kpis.bajasProcedidas, 2)
})
