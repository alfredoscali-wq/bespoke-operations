/**
 * Sprint Atención al Cliente 2.8 — Visibilidad del Trabajo Propio de Atención.
 */
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
  computePendingWorkByAreaKpis,
  computeSharedInboxStatusFilterCounts,
  filterSharedInboxRows,
  matchesSharedInboxStatusChip,
  PENDING_WORK_BY_AREA_ORDER,
  PENDING_WORK_BY_AREA_TRAY,
  resolveOperationalWorkTray,
} from "../lib/customer-atenciones/shared-inbox.ts"
import { formatConsultationInboxSituationLabel } from "../lib/customer-atenciones/consultation-expediente.ts"

const referenceDate = new Date("2026-07-25T15:00:00.000Z")

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

test("orden visual: Espera → Para Resolver → áreas especializadas", () => {
  assert.deepEqual([...PENDING_WORK_BY_AREA_ORDER], [
    "espera_cliente",
    "para_resolver",
    "tecnica",
    "administracion",
    "morosos",
    "retenciones",
    "ventas",
  ])
  assert.equal(PENDING_WORK_BY_AREA_TRAY.para_resolver, "por_tomar")
})

test("Para Resolver y Espera del Cliente no se mezclan", () => {
  const rows = [
    inboxRow({
      id: "accion",
      status: "para_resolver",
      nextStep: "seguimiento_cliente",
    }),
    inboxRow({
      id: "espera",
      status: "pendiente",
      nextStep: "esperar_cliente",
    }),
  ]

  const area = computePendingWorkByAreaKpis(rows)
  assert.equal(area.para_resolver, 1)
  assert.equal(area.espera_cliente, 1)
  assert.equal(area.tecnica, 0)
})

test("áreas especializadas no entran en Para Resolver", () => {
  const rows = [
    inboxRow({ id: "tec", nextStep: "resolver_consulta_tecnica" }),
    inboxRow({ id: "adm", nextStep: "derivar_admin_facturacion" }),
    inboxRow({ id: "mor", nextStep: "derivar_admin_morosos" }),
    inboxRow({ id: "ret", nextStep: "realizar_retencion" }),
    inboxRow({ id: "ven", nextStep: "contactar_cliente" }),
    inboxRow({
      id: "aten",
      status: "para_resolver",
      nextStep: "seguimiento_cliente",
    }),
  ]

  const area = computePendingWorkByAreaKpis(rows)
  assert.equal(area.tecnica, 1)
  assert.equal(area.administracion, 1)
  assert.equal(area.morosos, 1)
  assert.equal(area.retenciones, 1)
  assert.equal(area.ventas, 1)
  assert.equal(area.para_resolver, 1)
  assert.equal(area.espera_cliente, 0)
})

test("flujo Técnica → Contactar nuevamente: bandeja + chip + KPI área", () => {
  const createdStatus = resolveInitialConsultationStatusFromNextStep(
    TECHNICAL_NEXT_STEP
  )
  let row = inboxRow({
    status: createdStatus,
    nextStep: TECHNICAL_NEXT_STEP,
  })

  assert.equal(resolveOperationalWorkTray(row), "tecnica")
  assert.equal(computePendingWorkByAreaKpis([row]).tecnica, 1)
  assert.equal(computePendingWorkByAreaKpis([row]).para_resolver, 0)

  row = {
    ...row,
    status: "en_gestion",
    activeManagementEmployeeId: "tecnico-1",
    activeManagementEmployeeName: "Técnico",
  }
  assert.equal(resolveOperationalWorkTray(row), "tecnica")

  const action = mapTechnicalOutcomeToAction("seguimiento_con_cliente")
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

  assert.equal(row.status, "para_resolver")
  assert.equal(row.nextStep, "seguimiento_cliente")
  assert.equal(resolveOperationalWorkTray(row), "por_tomar")

  const discovery = [row]
  const area = computePendingWorkByAreaKpis(discovery)
  const chipCounts = computeSharedInboxStatusFilterCounts(
    discovery,
    referenceDate
  )

  assert.equal(area.tecnica, 0, "desaparece de Técnica")
  assert.equal(area.para_resolver, 1, "incrementa Para Resolver del área")
  assert.equal(area.espera_cliente, 0)
  assert.equal(chipCounts.para_resolver, 1)
  assert.equal(
    matchesSharedInboxStatusChip(row, "para_resolver", referenceDate),
    true
  )

  const bandejaParaResolver = filterSharedInboxRows(
    discovery,
    {
      statusFilter: "para_resolver",
      motivo: "all",
      channel: "all",
      createdDate: null,
      search: "",
    },
    referenceDate
  )
  assert.equal(bandejaParaResolver.length, 1)

  const filteredByAreaKpi = filterSharedInboxRows(
    discovery,
    {
      statusFilter: "all",
      workTray: PENDING_WORK_BY_AREA_TRAY.para_resolver,
      motivo: "all",
      channel: "all",
      createdDate: null,
      search: "",
    },
    referenceDate
  )
  assert.equal(filteredByAreaKpi.length, area.para_resolver)
  assert.equal(filteredByAreaKpi[0]?.id, "consulta-1")
})

test("KPI de área filtra la bandeja por cola operativa (sin filtros manuales extra)", () => {
  const rows = [
    inboxRow({
      id: "tec",
      nextStep: "resolver_consulta_tecnica",
    }),
    inboxRow({
      id: "adm",
      nextStep: "derivar_admin_facturacion",
    }),
    inboxRow({
      id: "mor",
      nextStep: "derivar_admin_morosos",
    }),
    inboxRow({
      id: "ret",
      nextStep: "realizar_retencion",
    }),
    inboxRow({
      id: "espera",
      status: "pendiente",
      nextStep: "esperar_cliente",
    }),
    inboxRow({
      id: "aten",
      status: "para_resolver",
      nextStep: "seguimiento_cliente",
    }),
  ]

  const area = computePendingWorkByAreaKpis(rows)
  const cases = [
    ["tecnica", "tec"],
    ["administracion", "adm"],
    ["morosos", "mor"],
    ["retenciones", "ret"],
    ["espera_cliente", "espera"],
    ["para_resolver", "aten"],
  ]

  for (const [areaKey, expectedId] of cases) {
    const tray = PENDING_WORK_BY_AREA_TRAY[areaKey]
    const filtered = filterSharedInboxRows(
      rows,
      {
        statusFilter: "all",
        workTray: tray,
        motivo: "all",
        channel: "all",
        createdDate: null,
        search: "",
      },
      referenceDate
    )
    assert.equal(filtered.length, area[areaKey], areaKey)
    assert.deepEqual(
      filtered.map((row) => row.id),
      [expectedId],
      areaKey
    )
  }
})

test("KPI de área conserva motivo activo (intersección sincronizada)", () => {
  const rows = [
    inboxRow({
      id: "tv-tec",
      motivo: "consulta_tv",
      nextStep: "resolver_consulta_tecnica",
    }),
    inboxRow({
      id: "other-tec",
      motivo: "problema_tecnico",
      nextStep: "resolver_consulta_tecnica",
    }),
  ]

  const filtered = filterSharedInboxRows(
    rows,
    {
      statusFilter: "all",
      workTray: "tecnica",
      motivo: "consulta_tv",
      channel: "all",
      createdDate: null,
      search: "",
    },
    referenceDate
  )

  assert.equal(filtered.length, 1)
  assert.equal(filtered[0]?.id, "tv-tec")
})

test("colas operativas alinean Situación Actual esperada", () => {
  assert.equal(
    formatConsultationInboxSituationLabel(
      inboxRow({ nextStep: "resolver_consulta_tecnica" })
    ),
    "Derivada a Técnica"
  )
  assert.equal(
    formatConsultationInboxSituationLabel(
      inboxRow({ nextStep: "derivar_admin_facturacion" })
    ),
    "Derivada a Administración"
  )
  assert.equal(
    formatConsultationInboxSituationLabel(
      inboxRow({ nextStep: "derivar_admin_morosos" })
    ),
    "Facturación - Morosos"
  )
  assert.equal(
    formatConsultationInboxSituationLabel(
      inboxRow({ nextStep: "realizar_retencion" })
    ),
    "Pendiente de Retención"
  )
  assert.equal(
    formatConsultationInboxSituationLabel(
      inboxRow({ status: "pendiente", nextStep: "esperar_cliente" })
    ),
    "Esperando respuesta del cliente"
  )
})
