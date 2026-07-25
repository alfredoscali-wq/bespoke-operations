import assert from "node:assert/strict"
import test from "node:test"

import {
  resolveDeferConsultationStatus,
} from "../lib/customer-atenciones/consultation-management.ts"
import {
  resolveInitialConsultationStatusFromNextStep,
} from "../lib/customer-atenciones/consultation.ts"
import {
  mapTechnicalOutcomeToAction,
  TECHNICAL_NEXT_STEP,
} from "../lib/customer-atenciones/technical-flow.ts"
import {
  computeSharedInboxStatusFilterCounts,
  filterSharedInboxRows,
  matchesParaResolverKpi,
  matchesSharedInboxStatusChip,
} from "../lib/customer-atenciones/shared-inbox.ts"

const referenceDate = new Date("2026-07-25T15:00:00.000Z")

const ALL_QUERY = {
  statusFilter: "all",
  motivo: "all",
  channel: "all",
  operationalCategory: null,
  workTray: null,
  createdDate: null,
  search: "",
}

const PARA_RESOLVER_QUERY = {
  ...ALL_QUERY,
  statusFilter: "para_resolver",
}

function inboxRow(overrides = {}) {
  return {
    id: "consulta-1",
    customerId: "customer-1",
    customerName: "Cliente Demo",
    channel: "whatsapp",
    motivo: "problema_tecnico",
    detail: "Sin servicio",
    status: "para_resolver",
    nextStep: TECHNICAL_NEXT_STEP,
    attendedByEmployeeId: "employee-1",
    attendedByEmployeeName: "Operador",
    activeManagementEmployeeId: null,
    activeManagementEmployeeName: null,
    activeManagementStartedAt: null,
    createdAt: "2026-07-25T10:00:00.000Z",
    updatedAt: "2026-07-25T10:00:00.000Z",
    ...overrides,
  }
}

/**
 * Integration: Nueva consulta → Técnica → Contactar nuevamente (seguimiento_cliente).
 * Bandeja rows, chip counts and Para resolver filter must share status === "para_resolver".
 */
test("flujo Técnica → Contactar nuevamente: chip y filtro alineados al badge", () => {
  // 1) Nueva consulta derivada a Técnica
  const createdStatus = resolveInitialConsultationStatusFromNextStep(
    TECHNICAL_NEXT_STEP
  )
  assert.equal(createdStatus, "para_resolver")

  let row = inboxRow({
    status: createdStatus,
    nextStep: TECHNICAL_NEXT_STEP,
  })

  // 2) Técnica toma la consulta
  row = {
    ...row,
    status: "en_gestion",
    activeManagementEmployeeId: "tecnico-1",
    activeManagementEmployeeName: "Técnico",
    updatedAt: "2026-07-25T11:00:00.000Z",
  }

  // 3) Técnica → "Requiere contacto con el cliente" / contactar nuevamente
  const action = mapTechnicalOutcomeToAction("seguimiento_con_cliente")
  assert.equal(action.kind, "defer")
  assert.equal(action.nextStep, "seguimiento_cliente")

  const returnedStatus = resolveDeferConsultationStatus(action.nextStep)
  assert.equal(returnedStatus, "para_resolver")

  row = {
    ...row,
    status: returnedStatus,
    nextStep: action.nextStep,
    activeManagementEmployeeId: null,
    activeManagementEmployeeName: null,
    activeManagementStartedAt: null,
    updatedAt: "2026-07-25T12:00:00.000Z",
  }

  // Badge condition (status field)
  assert.equal(row.status, "para_resolver")
  assert.equal(
    matchesSharedInboxStatusChip(row, "para_resolver", referenceDate),
    true
  )

  const discoveryBefore = []
  const discoveryAfter = [row]

  const countsBefore = computeSharedInboxStatusFilterCounts(
    discoveryBefore,
    referenceDate
  )
  const countsAfter = computeSharedInboxStatusFilterCounts(
    discoveryAfter,
    referenceDate
  )

  // Contador Para resolver +1
  assert.equal(countsAfter.para_resolver, countsBefore.para_resolver + 1)
  assert.equal(countsAfter.all, 1)

  // Visible en Todas
  const allRows = filterSharedInboxRows(
    discoveryAfter,
    ALL_QUERY,
    referenceDate
  )
  assert.equal(allRows.length, 1)
  assert.equal(allRows[0]?.id, "consulta-1")

  // Visible al filtrar Para resolver (misma condición que el contador)
  const paraResolverRows = filterSharedInboxRows(
    discoveryAfter,
    PARA_RESOLVER_QUERY,
    referenceDate
  )
  assert.equal(paraResolverRows.length, 1)
  assert.equal(paraResolverRows[0]?.id, "consulta-1")
  assert.equal(paraResolverRows.length, countsAfter.para_resolver)
})

test("chip Para resolver cuenta solo status para_resolver (no next_step KPI)", () => {
  const returned = inboxRow({
    status: "para_resolver",
    nextStep: "seguimiento_cliente",
  })
  const enGestion = inboxRow({
    id: "en-gestion",
    status: "en_gestion",
    nextStep: "generar_ot",
    activeManagementEmployeeId: "e2",
  })

  // KPI still counts en_gestion internal work; bandeja chip must not.
  assert.equal(matchesParaResolverKpi(enGestion), true)
  assert.equal(
    matchesSharedInboxStatusChip(enGestion, "para_resolver", referenceDate),
    false
  )

  const discovery = [returned, enGestion]
  const counts = computeSharedInboxStatusFilterCounts(discovery, referenceDate)
  const filtered = filterSharedInboxRows(
    discovery,
    PARA_RESOLVER_QUERY,
    referenceDate
  )

  assert.equal(counts.para_resolver, 1)
  assert.equal(filtered.length, counts.para_resolver)
  assert.deepEqual(
    filtered.map((row) => row.id),
    ["consulta-1"]
  )
})
