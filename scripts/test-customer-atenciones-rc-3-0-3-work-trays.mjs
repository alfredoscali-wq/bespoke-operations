/**
 * RC 3.0.3 — exclusive operational work trays.
 */
import assert from "node:assert/strict"
import test from "node:test"

import {
  computeOperationalTrayCounts,
  filterSharedInboxRows,
  getVisibleOperationalWorkTrays,
  resolveOperationalWorkTray,
} from "../lib/customer-atenciones/shared-inbox.ts"

function row(partial) {
  return {
    id: partial.id ?? "a1",
    companyId: "c1",
    customerId: "c1",
    customerName: "Cliente",
    channel: "telefono",
    motivo: "consulta",
    detail: "detalle",
    status: partial.status,
    nextStep: partial.nextStep ?? null,
    attendedByEmployeeId: "e0",
    attendedByEmployeeName: "Op",
    activeManagementEmployeeId: partial.activeManagementEmployeeId ?? null,
    activeManagementEmployeeName: null,
    activeManagementStartedAt: null,
    createdAt: "2026-07-17T10:00:00.000Z",
    updatedAt: "2026-07-17T10:00:00.000Z",
  }
}

test("specialized next_step wins over en_gestion", () => {
  assert.equal(
    resolveOperationalWorkTray(
      row({
        status: "en_gestion",
        nextStep: "resolver_consulta_tecnica",
        activeManagementEmployeeId: "e1",
      })
    ),
    "tecnica"
  )
})

test("atencion continuity maps to en_gestion when taken", () => {
  assert.equal(
    resolveOperationalWorkTray(
      row({
        status: "en_gestion",
        nextStep: "seguimiento_cliente",
        activeManagementEmployeeId: "e1",
      })
    ),
    "en_gestion"
  )
})

test("untaken seguimiento is por_tomar", () => {
  assert.equal(
    resolveOperationalWorkTray(
      row({ status: "para_resolver", nextStep: "seguimiento_cliente" })
    ),
    "por_tomar"
  )
})

test("morosos and administracion are exclusive", () => {
  assert.equal(
    resolveOperationalWorkTray(
      row({ status: "para_resolver", nextStep: "derivar_admin_morosos" })
    ),
    "morosos"
  )
  assert.equal(
    resolveOperationalWorkTray(
      row({ status: "para_resolver", nextStep: "derivar_admin_facturacion" })
    ),
    "administracion"
  )
})

test("each row counted once across trays", () => {
  const rows = [
    row({
      id: "1",
      status: "para_resolver",
      nextStep: "derivar_admin_morosos",
    }),
    row({
      id: "2",
      status: "para_resolver",
      nextStep: "derivar_admin_facturacion",
    }),
    row({
      id: "3",
      status: "en_gestion",
      nextStep: "seguimiento_cliente",
      activeManagementEmployeeId: "e1",
    }),
  ]
  const counts = computeOperationalTrayCounts(rows)
  assert.equal(counts.morosos, 1)
  assert.equal(counts.administracion, 1)
  assert.equal(counts.en_gestion, 1)
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0)
  assert.equal(total, 3)
})

test("workTray filter is exclusive and sticky-friendly", () => {
  const rows = [
    row({ id: "1", status: "para_resolver", nextStep: "generar_ot" }),
    row({ id: "2", status: "para_resolver", nextStep: "contactar_cliente" }),
  ]
  const filtered = filterSharedInboxRows(rows, {
    statusFilter: "all",
    workTray: "generar_ot",
  })
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].id, "1")

  const visible = getVisibleOperationalWorkTrays(
    computeOperationalTrayCounts(rows)
  )
  // RC 3.0.6: generar_ot is KPI-only; ventas remains as a work tray.
  assert.deepEqual(visible, ["ventas"])
})

test("UI trays omit Disponibles, En gestión and Generar OT", () => {
  const rows = [
    row({ id: "1", status: "para_resolver", nextStep: "seguimiento_cliente" }),
    row({
      id: "2",
      status: "en_gestion",
      nextStep: "seguimiento_cliente",
      activeManagementEmployeeId: "e1",
    }),
    row({ id: "3", status: "para_resolver", nextStep: "generar_ot" }),
    row({ id: "4", status: "pendiente", nextStep: "esperar_cliente" }),
  ]
  const visible = getVisibleOperationalWorkTrays(
    computeOperationalTrayCounts(rows)
  )
  assert.deepEqual(visible, ["espera_cliente"])
  assert.ok(!visible.includes("por_tomar"))
  assert.ok(!visible.includes("en_gestion"))
  assert.ok(!visible.includes("generar_ot"))
})
