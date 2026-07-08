import assert from "node:assert/strict"
import test from "node:test"

import {
  buildJornadaEntries,
  buildRetencionJornadaEntry,
  filterJornadaEntries,
} from "../lib/customer-seguimientos/jornada.ts"
import {
  getAtencionClienteKpiValue,
  mapKpiKeyToDashboardFilter,
} from "../lib/customer-seguimientos/kpis.ts"

test("mi jornada incorpora retenciones finalizadas hoy", () => {
  const entry = buildRetencionJornadaEntry({
    id: "retencion-1",
    kind: "retencion",
    completedAt: "2026-07-08T14:30:00.000Z",
    customerId: "customer-1",
    customerName: "Cliente X",
    resultado: "retenido",
    resolution: "Acuerdo alcanzado con el cliente",
  })

  assert.equal(entry.kind, "retencion")
  assert.match(entry.detail, /Retenido/)

  const entries = buildJornadaEntries({
    atenciones: [],
    seguimientos: [],
    retenciones: [
      {
        id: "retencion-1",
        kind: "retencion",
        completedAt: "2026-07-08T14:30:00.000Z",
        customerId: "customer-1",
        customerName: "Cliente X",
        resultado: "retenido",
        resolution: "Acuerdo alcanzado con el cliente",
      },
    ],
  })

  assert.equal(entries.length, 1)
  assert.equal(entries[0]?.kind, "retencion")
})

test("KPI retenciones activas usa conteo del empleado actual", () => {
  const summary = {
    atencionesHoy: 2,
    resueltas: 1,
    seguimientosPendientes: 3,
    retencionesActivas: 4,
  }

  assert.equal(getAtencionClienteKpiValue(summary, "retenciones_activas"), 4)
  assert.equal(
    mapKpiKeyToDashboardFilter("retenciones_activas", "none"),
    "retenciones_activas"
  )
})

test("filtro jornada retenciones aísla entradas completadas", () => {
  const entries = buildJornadaEntries({
    atenciones: [
      {
        atencion: {
          id: "atencion-1",
          companyId: "company-1",
          customerId: "customer-1",
          attendedByEmployeeId: "employee-1",
          channel: "whatsapp",
          motivo: "consulta",
          detail: "Detalle",
          resolution: "Resuelta",
          resultado: "resuelta",
          createdAt: "2026-07-08T11:00:00.000Z",
          updatedAt: "2026-07-08T11:00:00.000Z",
        },
        customerName: "Ana",
      },
    ],
    seguimientos: [],
    retenciones: [
      {
        id: "retencion-1",
        kind: "retencion",
        completedAt: "2026-07-08T14:30:00.000Z",
        customerId: "customer-2",
        customerName: "Cliente X",
        resultado: "retenido",
        resolution: "Acuerdo alcanzado",
      },
    ],
  })

  assert.equal(filterJornadaEntries(entries, "retenciones").length, 1)
})
