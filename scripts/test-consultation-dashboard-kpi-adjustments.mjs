import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { SHARED_INBOX_RECIBIDAS_HOY_INCLUDES_RESOLVED } from "../lib/customer-atenciones/consultation.ts"
import {
  computeHistoricalDaySummary,
  computeSharedInboxKpis,
  matchesConsultasRecibidasHoyKpi,
  matchesNuevasKpi,
  matchesOperationalInboxDefaultRow,
} from "../lib/customer-atenciones/shared-inbox.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const summaryPath = join(
  __dirname,
  "../components/atencion-cliente/consultation-inbox-summary.tsx"
)
const operationalPath = join(
  __dirname,
  "../components/atencion-cliente/consultation-operational-work-section.tsx"
)
const queriesPath = join(
  __dirname,
  "../lib/supabase/customer-atenciones.queries.ts"
)

const referenceDate = new Date("2026-07-12T15:00:00.000Z")

test("Ingresadas Hoy incluye resueltas creadas hoy", () => {
  const resolvedToday = {
    status: "resuelta",
    createdAt: "2026-07-12T08:00:00.000Z",
  }

  assert.equal(matchesConsultasRecibidasHoyKpi(resolvedToday, referenceDate), true)
  assert.equal(matchesNuevasKpi(resolvedToday, referenceDate), false)
  assert.equal(SHARED_INBOX_RECIBIDAS_HOY_INCLUDES_RESOLVED, true)
  assert.equal(
    computeSharedInboxKpis(
      [
        {
          id: "1",
          customerId: "c",
          customerName: "A",
          channel: "whatsapp",
          motivo: "facturacion",
          detail: "x",
          status: "resuelta",
          nextStep: null,
          attendedByEmployeeId: "e",
          attendedByEmployeeName: "E",
          activeManagementEmployeeId: null,
          activeManagementEmployeeName: null,
          activeManagementStartedAt: null,
          createdAt: "2026-07-12T08:00:00.000Z",
          updatedAt: "2026-07-12T10:00:00.000Z",
        },
      ],
      referenceDate
    ).nuevas,
    1
  )
})

test("KPI Ingresadas Hoy es informativo (sin filtrar bandeja)", () => {
  const source = readFileSync(summaryPath, "utf8")
  assert.match(source, /Ingresadas Hoy/)
  assert.match(source, /INFORMATIONAL_KPI_KEYS/)
  assert.match(source, /isInformational\s*\?\s*undefined/)
  assert.match(source, /Volumen de entrada del día seleccionado/)
})

test("mini-KPI sticky + check visual + limpiar filtro", () => {
  const source = readFileSync(operationalPath, "utf8")
  assert.match(source, /operationalCategory: category/)
  assert.doesNotMatch(source, /isActive \? null : category/)
  assert.match(source, /✓ \$\{config\.label\}/)
  assert.match(source, /Limpiar filtro/)
})

test("query DB de ingresadas hoy no limita a estados activos", () => {
  const source = readFileSync(queriesPath, "utf8")
  const fnStart = source.indexOf("async function fetchSharedInboxNuevasKpiCount")
  const fnEnd = source.indexOf(
    "export async function fetchSharedInboxKpiSummaryFromDb",
    fnStart
  )
  const fnBody = source.slice(fnStart, fnEnd)
  assert.doesNotMatch(fnBody, /SHARED_INBOX_ACTIVE_STATUSES/)
  assert.match(fnBody, /created_at/)
})

test("resumen histórico del día: ingresadas / resueltas / pendientes", () => {
  const summary = computeHistoricalDaySummary(
    [
      { createdAt: "2026-07-12T08:00:00.000Z", status: "para_resolver" },
      { createdAt: "2026-07-12T09:00:00.000Z", status: "resuelta" },
      { createdAt: "2026-07-12T10:00:00.000Z", status: "pendiente" },
      { createdAt: "2026-07-11T10:00:00.000Z", status: "para_resolver" },
    ],
    "2026-07-12",
    referenceDate
  )

  assert.equal(summary.ingresadas, 3)
  assert.equal(summary.resueltas, 1)
  assert.equal(summary.pendientes, 2)
})

test("bandeja operativa no incluye resueltas", () => {
  assert.equal(
    matchesOperationalInboxDefaultRow(
      { status: "resuelta", createdAt: "2026-07-12T08:00:00.000Z" },
      referenceDate
    ),
    false
  )
  assert.equal(
    matchesOperationalInboxDefaultRow(
      { status: "para_resolver", createdAt: "2026-07-10T08:00:00.000Z" },
      referenceDate
    ),
    true
  )
})
