import assert from "node:assert/strict"
import test from "node:test"

import {
  filterSharedInboxRows,
  getConsultationDayBoundsFromDateOnly,
  hasSharedInboxDiscoveryFilters,
  matchesSharedInboxCreatedDate,
  matchesSharedInboxSearch,
} from "../lib/customer-atenciones/shared-inbox.ts"

function makeRow(overrides = {}) {
  return {
    id: "a1",
    companyId: "c1",
    customerId: "cust-1",
    customerName: "Juan Pérez",
    channel: "whatsapp",
    motivo: "consulta",
    detail: "Cliente sin internet desde anoche",
    status: "para_resolver",
    nextStep: "seguimiento_cliente",
    attendedByEmployeeId: "e1",
    attendedByEmployeeName: "Ana",
    activeManagementEmployeeId: null,
    activeManagementEmployeeName: null,
    activeManagementStartedAt: null,
    createdAt: "2026-07-14T15:20:00.000Z",
    updatedAt: "2026-07-14T15:20:00.000Z",
    ...overrides,
  }
}

test("discovery filters detect fecha y búsqueda activas", () => {
  assert.equal(
    hasSharedInboxDiscoveryFilters({ createdDate: null, search: "" }),
    false
  )
  assert.equal(
    hasSharedInboxDiscoveryFilters({
      createdDate: "2026-07-14",
      search: "",
    }),
    true
  )
  assert.equal(
    hasSharedInboxDiscoveryFilters({
      createdDate: null,
      search: "Pérez",
    }),
    true
  )
})

test("búsqueda parcial por nombre y detalle", () => {
  const row = makeRow()
  assert.equal(matchesSharedInboxSearch(row, "Juan"), true)
  assert.equal(matchesSharedInboxSearch(row, "pérez"), true)
  assert.equal(matchesSharedInboxSearch(row, "sin internet"), true)
  assert.equal(matchesSharedInboxSearch(row, "cablemodem"), false)
})

test("fecha de creación filtra por día local", () => {
  const row = makeRow({ createdAt: "2026-07-14T15:20:00.000Z" })
  const localDay = new Date(row.createdAt)
  const yyyy = localDay.getFullYear()
  const mm = String(localDay.getMonth() + 1).padStart(2, "0")
  const dd = String(localDay.getDate()).padStart(2, "0")
  const dateOnly = `${yyyy}-${mm}-${dd}`

  assert.equal(matchesSharedInboxCreatedDate(row, dateOnly), true)
  assert.equal(matchesSharedInboxCreatedDate(row, "2000-01-01"), false)
  assert.ok(getConsultationDayBoundsFromDateOnly(dateOnly))
})

test("búsqueda global: no restringe por fecha ni re-filtra en memoria", () => {
  const localDay = new Date("2026-07-14T15:20:00.000Z")
  const dateOnly = `${localDay.getFullYear()}-${String(localDay.getMonth() + 1).padStart(2, "0")}-${String(localDay.getDate()).padStart(2, "0")}`

  const rows = [
    makeRow({
      id: "match",
      customerName: "Juan Pérez",
      createdAt: "2026-07-14T15:20:00.000Z",
    }),
    makeRow({
      id: "other-day",
      customerName: "Juan Pérez",
      createdAt: "2026-07-10T15:20:00.000Z",
    }),
    makeRow({
      id: "matched-by-db",
      customerName: "María Gómez",
      createdAt: "2026-07-14T12:00:00.000Z",
      detail: "Consulta de facturación",
    }),
  ]

  // La búsqueda es global: la base de datos ya hizo el matching (incluyendo
  // teléfono, DNI, número de cliente, código externo y dirección), por lo que
  // ninguna fila devuelta se descarta en memoria ni se limita por fecha.
  const filtered = filterSharedInboxRows(rows, {
    statusFilter: "all",
    createdDate: dateOnly,
    search: "Pérez",
  })

  assert.equal(filtered.length, 3)
})

test("sin fecha ni búsqueda no restringe el listado", () => {
  const rows = [makeRow({ id: "1" }), makeRow({ id: "2", customerName: "Otro" })]
  const filtered = filterSharedInboxRows(rows, {
    statusFilter: "all",
    createdDate: null,
    search: "",
  })
  assert.equal(filtered.length, 2)
})
