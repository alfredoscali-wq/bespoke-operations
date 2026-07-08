import assert from "node:assert/strict"
import test from "node:test"

import {
  buildJornadaEntries,
  filterJornadaEntries,
} from "../lib/customer-seguimientos/jornada.ts"
import {
  getAtencionClienteKpiValue,
  mapDashboardFilterToJornadaFilter,
  mapKpiKeyToDashboardFilter,
} from "../lib/customer-seguimientos/kpis.ts"

test("mi jornada combina atenciones y seguimientos completados del día", () => {
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
          detail: "Consulta",
          resolution: "Resuelta",
          resultado: "resuelta",
          createdAt: "2026-07-08T10:20:00.000Z",
          updatedAt: "2026-07-08T10:20:00.000Z",
        },
        customerName: "Carlos López",
      },
    ],
    seguimientos: [
      {
        id: "seguimiento-1",
        kind: "seguimiento",
        completedAt: "2026-07-08T09:15:00.000Z",
        customerId: "customer-2",
        customerName: "María González",
        completionAction: "Problema verificado",
        sourceAtencionId: "atencion-0",
      },
    ],
  })

  assert.equal(entries.length, 2)
  assert.equal(entries[0]?.kind, "atencion")
  assert.equal(entries[1]?.kind, "seguimiento")
})

test("filtros de jornada respetan KPIs clickeables", () => {
  const entries = buildJornadaEntries({
    atenciones: [
      {
        atencion: {
          id: "atencion-resuelta",
          companyId: "company-1",
          customerId: "customer-1",
          attendedByEmployeeId: "employee-1",
          channel: "telefono",
          motivo: "consulta",
          detail: "Detalle",
          resolution: "Resuelta",
          resultado: "resuelta",
          createdAt: "2026-07-08T11:00:00.000Z",
          updatedAt: "2026-07-08T11:00:00.000Z",
        },
        customerName: "Ana",
      },
      {
        atencion: {
          id: "atencion-seguimiento",
          companyId: "company-1",
          customerId: "customer-2",
          attendedByEmployeeId: "employee-1",
          channel: "whatsapp",
          motivo: "reclamo",
          detail: "Detalle",
          resolution: "Pendiente",
          resultado: "requiere_seguimiento",
          createdAt: "2026-07-08T12:00:00.000Z",
          updatedAt: "2026-07-08T12:00:00.000Z",
        },
        customerName: "Bruno",
      },
    ],
    seguimientos: [],
  })

  assert.equal(
    filterJornadaEntries(
      entries,
      mapDashboardFilterToJornadaFilter("jornada_atenciones")
    ).length,
    2
  )
  assert.equal(
    filterJornadaEntries(
      entries,
      mapDashboardFilterToJornadaFilter("jornada_resueltas")
    ).length,
    1
  )
})

test("KPI resueltas no incluye seguimientos completados", () => {
  const summary = {
    atencionesHoy: 3,
    resueltas: 2,
    seguimientosPendientes: 4,
  }

  assert.equal(getAtencionClienteKpiValue(summary, "resueltas"), 2)
  assert.equal(
    mapKpiKeyToDashboardFilter("seguimientos_pendientes", "none"),
    "agenda_seguimientos"
  )
  assert.equal(
    mapKpiKeyToDashboardFilter("seguimientos_pendientes", "agenda_seguimientos"),
    "none"
  )
})
