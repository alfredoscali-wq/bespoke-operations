import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  CONSULTATION_EXTERNAL_WAIT_NEXT_STEPS,
  CONSULTATION_PARA_RESOLVER_KPI_NEXT_STEPS,
  CONTINUAR_GESTION_MENU_REVIEW_PLANNED,
  SHARED_INBOX_NUEVAS_KPI_CREATED_TODAY,
  SHARED_INBOX_RECIBIDAS_HOY_INCLUDES_RESOLVED,
} from "../lib/customer-atenciones/consultation.ts"
import {
  computeSharedInboxKpis,
  filterSharedInboxRows,
  matchesParaResolverKpi,
  matchesPendientesKpi,
} from "../lib/customer-atenciones/shared-inbox.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const consultationPath = join(
  __dirname,
  "../lib/customer-atenciones/consultation.ts"
)
const sharedInboxPath = join(
  __dirname,
  "../lib/customer-atenciones/shared-inbox.ts"
)
const queriesPath = join(
  __dirname,
  "../lib/supabase/customer-atenciones.queries.ts"
)

const referenceDate = new Date("2026-07-12T15:00:00.000Z")

function inboxRow(overrides) {
  return {
    id: "row-1",
    customerId: "customer-1",
    customerName: "Juan Pérez",
    channel: "whatsapp",
    motivo: "facturacion",
    detail: "Consulta",
    status: "para_resolver",
    nextStep: "derivar_admin_facturacion",
    attendedByEmployeeId: "employee-1",
    attendedByEmployeeName: "Cintia",
    activeManagementEmployeeId: null,
    activeManagementEmployeeName: null,
    activeManagementStartedAt: null,
    createdAt: "2026-07-12T10:00:00.000Z",
    updatedAt: "2026-07-12T10:00:00.000Z",
    ...overrides,
  }
}

test("1. Para Resolver incluye trabajo interno de cualquier área", () => {
  const rows = [
    inboxRow({ id: "ret", nextStep: "realizar_retencion" }),
    inboxRow({ id: "adm", nextStep: "derivar_admin_facturacion" }),
    inboxRow({ id: "tec", nextStep: "resolver_consulta_tecnica" }),
    inboxRow({ id: "mor", nextStep: "derivar_admin_morosos" }),
    inboxRow({
      id: "gestion",
      status: "en_gestion",
      nextStep: "generar_ot",
      activeManagementEmployeeId: "employee-2",
    }),
  ]

  assert.equal(computeSharedInboxKpis(rows, referenceDate).para_resolver, 5)
})

test("2. derivar_admin_gestion cuenta como Para Resolver, no como Pendientes", () => {
  const row = inboxRow({
    status: "para_resolver",
    nextStep: "derivar_admin_gestion",
  })

  assert.equal(matchesParaResolverKpi(row), true)
  assert.equal(matchesPendientesKpi(row), false)
  assert.equal(computeSharedInboxKpis([row], referenceDate).para_resolver, 1)
  assert.equal(computeSharedInboxKpis([row], referenceDate).pendientes, 0)
})

test("3. Pendientes solo incluye espera de actor externo", () => {
  const row = inboxRow({
    status: "pendiente",
    nextStep: "esperar_cliente",
  })

  assert.equal(matchesPendientesKpi(row), true)
  assert.equal(matchesParaResolverKpi(row), false)
  assert.equal(computeSharedInboxKpis([row], referenceDate).pendientes, 1)
})

test("4. Resueltas hoy permanece sin cambios", () => {
  const row = inboxRow({
    status: "resuelta",
    nextStep: null,
    updatedAt: "2026-07-12T14:00:00.000Z",
  })

  assert.equal(computeSharedInboxKpis([row], referenceDate).resueltas_hoy, 1)
})

test("5. Consultas Recibidas Hoy cuenta todas las creadas hoy, incluidas resueltas", () => {
  const rows = [
    inboxRow({ id: "today", createdAt: "2026-07-12T08:00:00.000Z" }),
    inboxRow({
      id: "today-resolved",
      status: "resuelta",
      nextStep: null,
      createdAt: "2026-07-12T09:00:00.000Z",
      updatedAt: "2026-07-12T11:00:00.000Z",
    }),
    inboxRow({
      id: "yesterday",
      createdAt: "2026-07-11T08:00:00.000Z",
    }),
  ]

  assert.equal(computeSharedInboxKpis(rows, referenceDate).nuevas, 2)
})

test("6. filtro Para resolver alinea con la regla funcional", () => {
  const rows = [
    inboxRow({ id: "internal", nextStep: "contactar_cliente" }),
    inboxRow({ id: "external", status: "pendiente", nextStep: "esperar_cliente" }),
  ]

  const filtered = filterSharedInboxRows(
    rows,
    { statusFilter: "para_resolver", motivo: "all", channel: "all" },
    referenceDate
  )

  assert.deepEqual(
    filtered.map((row) => row.id),
    ["internal"]
  )
})

test("7. filtro Pendientes alinea con espera externa", () => {
  const rows = [
    inboxRow({ id: "internal", nextStep: "derivar_admin_facturacion" }),
    inboxRow({ id: "external", status: "pendiente", nextStep: "esperar_cliente" }),
  ]

  const filtered = filterSharedInboxRows(
    rows,
    { statusFilter: "pendiente", motivo: "all", channel: "all" },
    referenceDate
  )

  assert.deepEqual(
    filtered.map((row) => row.id),
    ["external"]
  )
})

test("8. constantes de clasificación funcional documentadas", () => {
  assert.equal(SHARED_INBOX_NUEVAS_KPI_CREATED_TODAY, true)
  assert.equal(SHARED_INBOX_RECIBIDAS_HOY_INCLUDES_RESOLVED, true)
  assert.equal(CONTINUAR_GESTION_MENU_REVIEW_PLANNED, false)
  assert.ok(CONSULTATION_PARA_RESOLVER_KPI_NEXT_STEPS.includes("derivar_admin_gestion"))
  assert.ok(!CONSULTATION_PARA_RESOLVER_KPI_NEXT_STEPS.includes("esperar_administracion"))
  assert.deepEqual([...CONSULTATION_EXTERNAL_WAIT_NEXT_STEPS], ["esperar_cliente"])
})

test("9. queries DB usan next_step para Para Resolver y Pendientes", () => {
  const queriesSource = readFileSync(queriesPath, "utf8")

  assert.match(queriesSource, /CONSULTATION_PARA_RESOLVER_KPI_NEXT_STEPS/)
  assert.match(queriesSource, /CONSULTATION_EXTERNAL_WAIT_NEXT_STEPS/)
  assert.match(queriesSource, /fetchSharedInboxNuevasKpiCount/)
})

test("10. Continuar Gestión refleja menú Sprint 2.8", () => {
  const consultationSource = readFileSync(consultationPath, "utf8")
  const formatPath = join(__dirname, "../lib/customer-atenciones/format.ts")
  const formatSource = readFileSync(formatPath, "utf8")

  assert.match(consultationSource, /CONTINUAR_GESTION_MENU_REVIEW_PLANNED/)
  assert.match(formatSource, /CUSTOMER_ATENCION_NEXT_STEP_OPTIONS/)
  assert.match(consultationSource, /derivar_admin_morosos/)
  assert.doesNotMatch(consultationSource, /facturacion_morosos/)
})
