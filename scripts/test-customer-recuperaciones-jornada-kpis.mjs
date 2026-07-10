import assert from "node:assert/strict"
import test from "node:test"

import {
  buildEquipoIndividualReportKpis,
} from "../lib/atencion-cliente-equipo/report.ts"
import {
  buildJornadaEntries,
  buildRecuperacionJornadaEntry,
  filterJornadaEntries,
} from "../lib/customer-seguimientos/jornada.ts"
import {
  getAtencionClienteKpiValue,
  mapDashboardFilterToJornadaFilter,
  mapKpiKeyToDashboardFilter,
} from "../lib/customer-seguimientos/kpis.ts"

test("mi jornada incorpora gestiones de recupero del día", () => {
  const entry = buildRecuperacionJornadaEntry({
    id: "recupero-1",
    kind: "recupero",
    occurredAt: "2026-07-08T14:30:00.000Z",
    displayName: "Cliente X",
    zoneLabel: "Centro",
    channel: "telefono",
    offer: "Plan promocional",
    resultado: "recuperado",
    observation: "Aceptó volver",
  })

  assert.equal(entry.kind, "recupero")
  assert.match(entry.detail, /Recuperado/)

  const entries = buildJornadaEntries({
    atenciones: [],
    seguimientos: [],
    recuperaciones: [
      {
        id: "recupero-1",
        kind: "recupero",
        occurredAt: "2026-07-08T14:30:00.000Z",
        displayName: "Cliente X",
        zoneLabel: "Centro",
        channel: "telefono",
        offer: "Plan promocional",
        resultado: "recuperado",
        observation: "Aceptó volver",
      },
    ],
  })

  assert.equal(entries.length, 1)
  assert.equal(entries[0]?.kind, "recupero")
})

test("KPI recuperos hoy usa conteo del empleado actual", () => {
  const summary = {
    atencionesHoy: 2,
    resueltas: 1,
    seguimientosPendientes: 3,
    retencionesActivas: 4,
    recuperosHoy: 5,
  }

  assert.equal(getAtencionClienteKpiValue(summary, "recuperos_hoy"), 5)
  assert.equal(
    mapKpiKeyToDashboardFilter("recuperos_hoy", "none"),
    "mi_recupero"
  )
  assert.equal(
    mapDashboardFilterToJornadaFilter("mi_recupero"),
    "recuperos"
  )
})

test("filtro jornada recuperos aísla entradas de recupero", () => {
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
    recuperaciones: [
      {
        id: "recupero-1",
        kind: "recupero",
        occurredAt: "2026-07-08T14:30:00.000Z",
        displayName: "Cliente X",
        zoneLabel: "Centro",
        channel: "telefono",
        offer: "Plan promocional",
        resultado: "interesado",
        observation: "Interesado",
      },
    ],
  })

  assert.equal(filterJornadaEntries(entries, "recuperos").length, 1)
})

test("reporte individual expone KPIs de recupero del período", () => {
  const kpis = buildEquipoIndividualReportKpis({
    atenciones: 1,
    atencionesResueltas: 1,
    seguimientosResueltos: 0,
    seguimientosCompletados: 0,
    seguimientosPendientes: 0,
    retencionesGestionadas: 0,
    clientesRetenidos: 0,
    bajasProcedidas: 0,
    recuperosGestionados: 3,
    clientesRecuperados: 1,
  })

  assert.equal(kpis.recuperosGestionados, 3)
  assert.equal(kpis.clientesRecuperados, 1)
})

test("actividad del período combina recuperos con otras gestiones", () => {
  const entries = buildJornadaEntries({
    atenciones: [],
    seguimientos: [],
    recuperaciones: [
      {
        id: "recupero-1",
        kind: "recupero",
        occurredAt: "2026-07-08T16:00:00.000Z",
        displayName: "Excliente",
        zoneLabel: "Sur",
        channel: "whatsapp",
        offer: "Descuento",
        resultado: "recuperado",
        observation: "Volvió",
      },
    ],
  })

  assert.equal(entries[0]?.title, "Recupero")
  assert.equal(entries[0]?.subtitle, "Excliente")
})
