import assert from "node:assert/strict"
import test from "node:test"

import {
  applyAssignedRetencionSupervisionView,
  filterAssignedRetenciones,
  sortAssignedRetencionesByCreatedAtDesc,
} from "../lib/customer-retenciones/supervision.ts"

const sampleRows = [
  {
    id: "retencion-1",
    customerId: "customer-1",
    customerName: "Cliente A",
    assignedEmployeeId: "employee-1",
    assignedEmployeeName: "Cintia",
    assignedByEmployeeId: "employee-2",
    assignedByEmployeeName: "Admin",
    motivoBaja: "mudanza",
    detail: "Detalle A",
    status: "pendiente",
    resultado: null,
    resolution: null,
    completedAt: null,
    createdAt: "2026-07-08T10:00:00.000Z",
  },
  {
    id: "retencion-2",
    customerId: "customer-2",
    customerName: "Cliente B",
    assignedEmployeeId: "employee-1",
    assignedEmployeeName: "Cintia",
    assignedByEmployeeId: "employee-2",
    assignedByEmployeeName: "Admin",
    motivoBaja: "precio_situacion_economica",
    detail: "Detalle B",
    status: "finalizada",
    resultado: "retenido",
    resolution: "Acuerdo alcanzado",
    completedAt: "2026-07-08T15:00:00.000Z",
    createdAt: "2026-07-08T12:00:00.000Z",
  },
  {
    id: "retencion-3",
    customerId: "customer-3",
    customerName: "Cliente C",
    assignedEmployeeId: "employee-3",
    assignedEmployeeName: "Ana",
    assignedByEmployeeId: "employee-2",
    assignedByEmployeeName: "Admin",
    motivoBaja: "otro",
    detail: "Detalle C",
    status: "finalizada",
    resultado: "no_retenido",
    resolution: "Cliente confirma baja",
    completedAt: "2026-07-08T16:00:00.000Z",
    createdAt: "2026-07-08T14:00:00.000Z",
  },
]

test("filtro pendientes y finalizadas respeta el estado", () => {
  assert.equal(filterAssignedRetenciones(sampleRows, "pendientes").length, 1)
  assert.equal(filterAssignedRetenciones(sampleRows, "finalizadas").length, 2)
  assert.equal(filterAssignedRetenciones(sampleRows, "todas").length, 3)
})

test("orden de supervisión prioriza la asignación más reciente", () => {
  const sorted = sortAssignedRetencionesByCreatedAtDesc(sampleRows)

  assert.equal(sorted[0]?.id, "retencion-3")
  assert.equal(sorted[1]?.id, "retencion-2")
  assert.equal(sorted[2]?.id, "retencion-1")
})

test("vista de supervisión combina filtro y orden", () => {
  const visible = applyAssignedRetencionSupervisionView(
    sampleRows,
    "finalizadas"
  )

  assert.deepEqual(
    visible.map((row) => row.id),
    ["retencion-3", "retencion-2"]
  )
})
