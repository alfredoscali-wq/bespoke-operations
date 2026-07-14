import assert from "node:assert/strict"
import test from "node:test"

import {
  computeSharedInboxKpis,
  filterSharedInboxRows,
  isOperationalInboxView,
  matchesOperationalInboxDefaultRow,
  resolveSharedInboxReferenceDate,
} from "../lib/customer-atenciones/shared-inbox.ts"
import { toLocalDateOnly } from "../lib/dates/date-only.ts"

const now = new Date(2026, 6, 14, 15, 0, 0) // 14 Jul 2026 local
const today = toLocalDateOnly(now)
const referenceDate = resolveSharedInboxReferenceDate(
  { createdDate: today },
  now
)

function makeRow(overrides = {}) {
  return {
    id: "a1",
    companyId: "c1",
    customerId: "cust-1",
    customerName: "Juan Pérez",
    channel: "whatsapp",
    motivo: "consulta",
    detail: "Detalle",
    status: "para_resolver",
    nextStep: "resolver_consulta_tecnica",
    attendedByEmployeeId: "e1",
    attendedByEmployeeName: "Ana",
    activeManagementEmployeeId: null,
    activeManagementEmployeeName: null,
    activeManagementStartedAt: null,
    createdAt: new Date(2026, 6, 14, 10, 0, 0).toISOString(),
    updatedAt: new Date(2026, 6, 14, 10, 0, 0).toISOString(),
    ...overrides,
  }
}

test("vista operativa: hoy sin búsqueda ni resueltas", () => {
  assert.equal(
    isOperationalInboxView(
      { createdDate: today, search: "", statusFilter: "all" },
      now
    ),
    true
  )
  assert.equal(
    isOperationalInboxView(
      { createdDate: "2026-07-10", search: "", statusFilter: "all" },
      now
    ),
    false
  )
  assert.equal(
    isOperationalInboxView(
      { createdDate: today, search: "Pérez", statusFilter: "all" },
      now
    ),
    false
  )
  assert.equal(
    isOperationalInboxView(
      { createdDate: today, search: "", statusFilter: "resueltas_hoy" },
      now
    ),
    false
  )
})

test("fila operativa: backlog + nuevas del día; sin resueltas", () => {
  assert.equal(
    matchesOperationalInboxDefaultRow(
      makeRow({
        status: "para_resolver",
        createdAt: new Date(2026, 6, 10, 10, 0, 0).toISOString(),
      }),
      referenceDate
    ),
    true
  )
  assert.equal(
    matchesOperationalInboxDefaultRow(
      makeRow({ status: "nueva", nextStep: null }),
      referenceDate
    ),
    true
  )
  assert.equal(
    matchesOperationalInboxDefaultRow(
      makeRow({
        status: "nueva",
        nextStep: null,
        createdAt: new Date(2026, 6, 13, 9, 0, 0).toISOString(),
      }),
      referenceDate
    ),
    false
  )
  assert.equal(
    matchesOperationalInboxDefaultRow(
      makeRow({ status: "resuelta", nextStep: null }),
      referenceDate
    ),
    false
  )
})

test("listado operativo default excluye resueltas e incluye backlog", () => {
  const rows = [
    makeRow({
      id: "backlog",
      status: "para_resolver",
      nextStep: "resolver_consulta_tecnica",
      createdAt: new Date(2026, 6, 10, 10, 0, 0).toISOString(),
    }),
    makeRow({
      id: "nueva-hoy",
      status: "nueva",
      nextStep: null,
    }),
    makeRow({
      id: "nueva-ayer",
      status: "nueva",
      nextStep: null,
      createdAt: new Date(2026, 6, 13, 9, 0, 0).toISOString(),
    }),
    makeRow({
      id: "resuelta",
      status: "resuelta",
      nextStep: null,
      updatedAt: new Date(2026, 6, 14, 11, 0, 0).toISOString(),
    }),
  ]

  const filtered = filterSharedInboxRows(
    rows,
    {
      statusFilter: "all",
      createdDate: today,
      search: "",
    },
    referenceDate,
    now
  )

  assert.deepEqual(
    filtered.map((row) => row.id).sort(),
    ["backlog", "nueva-hoy"]
  )
})

test("historial de un día incluye resueltas del día", () => {
  const historicalDay = "2026-07-10"
  const historicalNow = new Date(2026, 6, 14, 15, 0, 0)
  const historicalRef = resolveSharedInboxReferenceDate(
    { createdDate: historicalDay },
    historicalNow
  )

  const rows = [
    makeRow({
      id: "creada",
      createdAt: new Date(2026, 6, 10, 10, 0, 0).toISOString(),
      status: "para_resolver",
      nextStep: "resolver_consulta_tecnica",
    }),
    makeRow({
      id: "resuelta-dia",
      status: "resuelta",
      nextStep: null,
      createdAt: new Date(2026, 6, 8, 10, 0, 0).toISOString(),
      updatedAt: new Date(2026, 6, 10, 18, 0, 0).toISOString(),
    }),
    makeRow({
      id: "otro-dia",
      createdAt: new Date(2026, 6, 11, 10, 0, 0).toISOString(),
    }),
  ]

  const filtered = filterSharedInboxRows(
    rows,
    {
      statusFilter: "all",
      createdDate: historicalDay,
      search: "",
    },
    historicalRef,
    historicalNow
  )

  assert.deepEqual(
    filtered.map((row) => row.id).sort(),
    ["creada", "resuelta-dia"]
  )
})

test("KPIs del día seleccionado: ingresadas y resueltas", () => {
  const rows = [
    makeRow({
      id: "ing-activa",
      status: "para_resolver",
      nextStep: "resolver_consulta_tecnica",
    }),
    makeRow({
      id: "ing-resuelta",
      status: "resuelta",
      nextStep: null,
      updatedAt: new Date(2026, 6, 14, 12, 0, 0).toISOString(),
    }),
    makeRow({
      id: "resuelta-creada-antes",
      status: "resuelta",
      nextStep: null,
      createdAt: new Date(2026, 6, 12, 10, 0, 0).toISOString(),
      updatedAt: new Date(2026, 6, 14, 13, 0, 0).toISOString(),
    }),
    makeRow({
      id: "pendiente",
      status: "pendiente",
      nextStep: "esperar_cliente",
    }),
  ]

  const kpis = computeSharedInboxKpis(rows, referenceDate)
  assert.equal(kpis.nuevas, 3) // ingresadas creadas el día
  assert.equal(kpis.resueltas_hoy, 2)
  assert.equal(kpis.para_resolver, 1)
  assert.equal(kpis.pendientes, 1)
})

test("filtro Ingresadas = creadas en el día (incluye resueltas)", () => {
  const rows = [
    makeRow({
      id: "activa",
      status: "para_resolver",
      nextStep: "resolver_consulta_tecnica",
    }),
    makeRow({
      id: "resuelta-hoy",
      status: "resuelta",
      nextStep: null,
    }),
    makeRow({
      id: "ayer",
      status: "para_resolver",
      nextStep: "resolver_consulta_tecnica",
      createdAt: new Date(2026, 6, 13, 10, 0, 0).toISOString(),
    }),
  ]

  const filtered = filterSharedInboxRows(
    rows,
    {
      statusFilter: "nueva",
      createdDate: today,
      search: "",
    },
    referenceDate,
    now
  )

  assert.deepEqual(
    filtered.map((row) => row.id).sort(),
    ["activa", "resuelta-hoy"]
  )
})
