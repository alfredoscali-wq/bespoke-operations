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

test("mi jornada incorpora retenido y persiste_baja", () => {
  const retained = buildRetencionJornadaEntry({
    id: "retencion-1",
    kind: "retencion",
    occurredAt: "2026-07-08T14:30:00.000Z",
    customerId: "customer-1",
    customerName: "Cliente X",
    resultado: "retenido",
    resolution: "Acuerdo alcanzado con el cliente",
  })

  assert.equal(retained.kind, "retencion")
  assert.match(retained.detail, /Retenido/)

  const derived = buildRetencionJornadaEntry({
    id: "retencion-2",
    kind: "retencion",
    occurredAt: "2026-07-08T15:30:00.000Z",
    customerId: "customer-2",
    customerName: "Cliente Y",
    resultado: "persiste_baja",
    resolution: "Derivada a Administración",
  })

  assert.match(derived.detail, /Persiste con la baja/)

  const entries = buildJornadaEntries({
    atenciones: [],
    seguimientos: [],
    retenciones: [
      {
        id: "retencion-1",
        kind: "retencion",
        occurredAt: "2026-07-08T14:30:00.000Z",
        customerId: "customer-1",
        customerName: "Cliente X",
        resultado: "retenido",
        resolution: "Acuerdo alcanzado con el cliente",
      },
      {
        id: "retencion-2",
        kind: "retencion",
        occurredAt: "2026-07-08T15:30:00.000Z",
        customerId: "customer-2",
        customerName: "Cliente Y",
        resultado: "persiste_baja",
        resolution: "Derivada a Administración",
      },
    ],
  })

  assert.equal(entries.length, 2)
})

test("KPI gestiones de baja activas usa conteo del empleado actual", () => {
  const summary = {
    atencionesHoy: 2,
    resueltas: 1,
    seguimientosPendientes: 3,
    retencionesActivas: 4,
    recuperosHoy: 0,
  }

  assert.equal(getAtencionClienteKpiValue(summary, "retenciones_activas"), 4)
  assert.equal(
    mapKpiKeyToDashboardFilter("retenciones_activas", "none"),
    "retenciones_activas"
  )
})

test("filtro jornada retenciones aísla entradas de gestión de baja", () => {
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
        occurredAt: "2026-07-08T14:30:00.000Z",
        customerId: "customer-2",
        customerName: "Cliente X",
        resultado: "retenido",
        resolution: "Acuerdo alcanzado",
      },
    ],
  })

  assert.equal(filterJornadaEntries(entries, "retenciones").length, 1)
})
