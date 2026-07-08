import assert from "node:assert/strict"
import test from "node:test"

import { canViewEquipoIndividualReport } from "../lib/atencion-cliente-equipo/access.ts"
import {
  formatEquipoReportPeriodLabel,
  resolveEquipoReportPeriodBounds,
} from "../lib/atencion-cliente-equipo/period.ts"
import {
  buildEquipoIndividualReportKpis,
  computeResueltasKpi,
} from "../lib/atencion-cliente-equipo/report.ts"
import { buildJornadaEntries } from "../lib/customer-seguimientos/jornada.ts"

const referenceDate = new Date(2026, 6, 8, 12, 0, 0, 0)

test("solo administrador puede acceder a Equipo + Reporte Individual", () => {
  assert.equal(canViewEquipoIndividualReport("administrador"), true)
  assert.equal(canViewEquipoIndividualReport("administracion"), false)
  assert.equal(canViewEquipoIndividualReport("atencion_cliente"), false)
  assert.equal(canViewEquipoIndividualReport(null), false)
})

test("resolución Hoy usa el día calendario actual", () => {
  const bounds = resolveEquipoReportPeriodBounds("hoy", referenceDate)

  assert.equal(bounds.startDateKey, "2026-07-08")
  assert.equal(bounds.endDateKey, "2026-07-08")
  assert.equal(new Date(bounds.end).getTime() > new Date(bounds.start).getTime(), true)
})

test("resolución Semana usa la semana calendario actual", () => {
  const bounds = resolveEquipoReportPeriodBounds("semana", referenceDate)

  assert.equal(bounds.startDateKey, "2026-07-06")
  assert.equal(bounds.endDateKey, "2026-07-12")
})

test("resolución Mes usa el mes calendario actual", () => {
  const bounds = resolveEquipoReportPeriodBounds("mes", referenceDate)

  assert.equal(bounds.startDateKey, "2026-07-01")
  assert.equal(bounds.endDateKey, "2026-07-31")
  assert.equal(formatEquipoReportPeriodLabel("mes"), "Mes")
})

test("KPI Resueltas suma atenciones resueltas y seguimientos realmente resueltos", () => {
  assert.equal(computeResueltasKpi(2, 1), 3)

  const kpis = buildEquipoIndividualReportKpis({
    atenciones: 4,
    atencionesResueltas: 2,
    seguimientosResueltos: 1,
    seguimientosCompletados: 2,
    seguimientosPendientes: 3,
    retencionesGestionadas: 2,
    clientesRetenidos: 1,
    noRetenidos: 1,
  })

  assert.equal(kpis.atenciones, 4)
  assert.equal(kpis.resueltas, 3)
  assert.equal(kpis.seguimientosCompletados, 2)
  assert.equal(kpis.seguimientosPendientes, 3)
  assert.equal(kpis.retencionesGestionadas, 2)
  assert.equal(kpis.clientesRetenidos, 1)
  assert.equal(kpis.noRetenidos, 1)
})

test("actividad del período combina atenciones, seguimientos y retenciones", () => {
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
        customerName: "Cliente Z",
      },
    ],
    seguimientos: [
      {
        id: "seguimiento-1",
        kind: "seguimiento",
        completedAt: "2026-07-08T10:20:00.000Z",
        customerId: "customer-2",
        customerName: "Cliente Y",
        completionAction: "Problema solucionado",
        sourceAtencionId: "atencion-0",
      },
    ],
    retenciones: [
      {
        id: "retencion-1",
        kind: "retencion",
        completedAt: "2026-07-08T14:30:00.000Z",
        customerId: "customer-3",
        customerName: "Cliente X",
        resultado: "retenido",
        resolution: "Acuerdo alcanzado con el cliente",
      },
    ],
  })

  assert.equal(entries.length, 3)
  assert.equal(entries[0]?.kind, "retencion")
  assert.equal(entries[1]?.kind, "atencion")
  assert.equal(entries[2]?.kind, "seguimiento")
})
