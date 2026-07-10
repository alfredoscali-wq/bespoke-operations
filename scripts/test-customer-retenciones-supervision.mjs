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
    assignedByEmployeeId: "employee-1",
    assignedByEmployeeName: "Cintia",
    motivoBaja: "mudanza",
    detail: "Detalle A",
    status: "en_gestion",
    resultado: null,
    resolution: null,
    completedAt: null,
    administrationPendingAt: null,
    createdAt: "2026-07-08T10:00:00.000Z",
  },
  {
    id: "retencion-2",
    customerId: "customer-2",
    customerName: "Cliente B",
    assignedEmployeeId: "employee-1",
    assignedEmployeeName: "Cintia",
    assignedByEmployeeId: "employee-1",
    assignedByEmployeeName: "Cintia",
    motivoBaja: "precio_situacion_economica",
    detail: "Detalle B",
    status: "finalizada",
    resultado: "retenido",
    resolution: "Acuerdo alcanzado",
    completedAt: "2026-07-08T15:00:00.000Z",
    administrationPendingAt: null,
    createdAt: "2026-07-08T12:00:00.000Z",
  },
  {
    id: "retencion-3",
    customerId: "customer-3",
    customerName: "Cliente C",
    assignedEmployeeId: "employee-3",
    assignedEmployeeName: "Ana",
    assignedByEmployeeId: "employee-3",
    assignedByEmployeeName: "Ana",
    motivoBaja: "otro",
    detail: "Detalle C",
    status: "pendiente_administracion",
    resultado: "persiste_baja",
    resolution: "Cliente confirma baja",
    completedAt: null,
    administrationPendingAt: "2026-07-08T16:00:00.000Z",
    createdAt: "2026-07-08T14:00:00.000Z",
  },
  {
    id: "retencion-4",
    customerId: "customer-4",
    customerName: "Cliente D",
    assignedEmployeeId: "employee-3",
    assignedEmployeeName: "Ana",
    assignedByEmployeeId: "employee-3",
    assignedByEmployeeName: "Ana",
    motivoBaja: "otro",
    detail: "Detalle D",
    status: "pendiente_retiro",
    resultado: "persiste_baja",
    resolution: "Lista para retiro",
    completedAt: null,
    administrationPendingAt: "2026-07-08T16:30:00.000Z",
    createdAt: "2026-07-08T13:00:00.000Z",
  },
]

test("filtros de supervisión respetan los nuevos estados", () => {
  assert.equal(
    filterAssignedRetenciones(sampleRows, "pendientes_administracion").length,
    1
  )
  assert.equal(
    filterAssignedRetenciones(sampleRows, "pendientes_retiro").length,
    1
  )
  assert.equal(filterAssignedRetenciones(sampleRows, "finalizadas").length, 1)
  assert.equal(filterAssignedRetenciones(sampleRows, "todas").length, 4)
})

test("orden de supervisión prioriza la gestión más reciente", () => {
  const sorted = sortAssignedRetencionesByCreatedAtDesc(sampleRows)

  assert.equal(sorted[0]?.id, "retencion-3")
})

test("vista de supervisión combina filtro y orden", () => {
  const visible = applyAssignedRetencionSupervisionView(
    sampleRows,
    "finalizadas"
  )

  assert.deepEqual(visible.map((row) => row.id), ["retencion-2"])
})
