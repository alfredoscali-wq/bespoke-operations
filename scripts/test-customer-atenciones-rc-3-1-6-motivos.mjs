/**
 * RC 3.1.6 — simplified motivos + commercial KPIs.
 */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  CUSTOMER_ATENCION_MOTIVO_OPTIONS,
  formatCustomerAtencionMotivoLabel,
} from "../lib/customer-atenciones/format.ts"
import { computeSharedInboxKpis, filterSharedInboxDiscoveryRows, computeSharedInboxStatusFilterCounts, filterSharedInboxRows } from "../lib/customer-atenciones/shared-inbox.ts"
import { mapCustomerAtencionRowToCustomerAtencion } from "../lib/supabase/customer-atenciones.mapper.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))

test("motivos RC 3.1.6: opciones y labels", () => {
  const values = CUSTOMER_ATENCION_MOTIVO_OPTIONS.map((item) => item.value)
  assert.deepEqual(values, [
    "problema_tecnico",
    "facturacion",
    "cambio_plan_tecnologia",
    "consulta_comercial",
    "consulta_tv",
    "nuevo_servicio",
    "baja",
    "otro",
  ])
  assert.equal(
    formatCustomerAtencionMotivoLabel("consulta_comercial"),
    "Consulta Comercial"
  )
  assert.equal(
    formatCustomerAtencionMotivoLabel("consulta_tv"),
    "Consulta sobre TV"
  )
  assert.equal(formatCustomerAtencionMotivoLabel("baja"), "Baja del servicio")
  assert.ok(!values.includes("consulta"))
  assert.ok(!values.includes("retencion"))
})

test("KPIs comerciales cuentan solo pendientes activos por motivo", () => {
  const referenceDate = new Date("2026-07-18T15:00:00.000Z")
  const rows = [
    {
      id: "1",
      companyId: "c1",
      customerId: "cu1",
      customerName: "A",
      channel: "telefono",
      motivo: "consulta_comercial",
      detail: "x",
      status: "para_resolver",
      nextStep: "seguimiento_cliente",
      attendedByEmployeeId: "e1",
      attendedByEmployeeName: "Op",
      activeManagementEmployeeId: null,
      activeManagementEmployeeName: null,
      activeManagementStartedAt: null,
      createdAt: "2026-07-18T10:00:00.000Z",
      updatedAt: "2026-07-18T10:00:00.000Z",
    },
    {
      id: "2",
      companyId: "c1",
      customerId: "cu2",
      customerName: "B",
      channel: "whatsapp",
      motivo: "consulta_tv",
      detail: "y",
      status: "nueva",
      nextStep: null,
      attendedByEmployeeId: "e1",
      attendedByEmployeeName: "Op",
      activeManagementEmployeeId: null,
      activeManagementEmployeeName: null,
      activeManagementStartedAt: null,
      createdAt: "2026-07-18T11:00:00.000Z",
      updatedAt: "2026-07-18T11:00:00.000Z",
    },
    {
      id: "3",
      companyId: "c1",
      customerId: "cu3",
      customerName: "C",
      channel: "telefono",
      motivo: "consulta_comercial",
      detail: "old backlog",
      status: "para_resolver",
      nextStep: "seguimiento_cliente",
      attendedByEmployeeId: "e1",
      attendedByEmployeeName: "Op",
      activeManagementEmployeeId: null,
      activeManagementEmployeeName: null,
      activeManagementStartedAt: null,
      createdAt: "2026-07-17T10:00:00.000Z",
      updatedAt: "2026-07-17T10:00:00.000Z",
    },
    {
      id: "4",
      companyId: "c1",
      customerId: "cu4",
      customerName: "D",
      channel: "telefono",
      motivo: "consulta_tv",
      detail: "resolved today",
      status: "resuelta",
      nextStep: null,
      attendedByEmployeeId: "e1",
      attendedByEmployeeName: "Op",
      activeManagementEmployeeId: null,
      activeManagementEmployeeName: null,
      activeManagementStartedAt: null,
      createdAt: "2026-07-18T09:00:00.000Z",
      updatedAt: "2026-07-18T12:00:00.000Z",
    },
  ]

  const kpis = computeSharedInboxKpis(rows, referenceDate)
  assert.equal(kpis.consulta_comercial, 2)
  assert.equal(kpis.consulta_tv, 1)
  assert.equal(kpis.nuevas, 3)
})

test("Resueltas hoy + motivo: conteo y grilla usan el mismo criterio", () => {
  const referenceDate = new Date("2026-07-18T15:00:00.000Z")
  const rows = [
    {
      id: "tv-resolved",
      companyId: "c1",
      customerId: "cu1",
      customerName: "A",
      channel: "telefono",
      motivo: "consulta_tv",
      detail: "ok",
      status: "resuelta",
      nextStep: null,
      attendedByEmployeeId: "e1",
      attendedByEmployeeName: "Op",
      activeManagementEmployeeId: null,
      activeManagementEmployeeName: null,
      activeManagementStartedAt: null,
      createdAt: "2026-07-18T09:00:00.000Z",
      updatedAt: "2026-07-18T12:00:00.000Z",
    },
    {
      id: "tv-active",
      companyId: "c1",
      customerId: "cu2",
      customerName: "B",
      channel: "whatsapp",
      motivo: "consulta_tv",
      detail: "pending",
      status: "para_resolver",
      nextStep: "seguimiento_cliente",
      attendedByEmployeeId: "e1",
      attendedByEmployeeName: "Op",
      activeManagementEmployeeId: null,
      activeManagementEmployeeName: null,
      activeManagementStartedAt: null,
      createdAt: "2026-07-18T11:00:00.000Z",
      updatedAt: "2026-07-18T11:00:00.000Z",
    },
    {
      id: "other-resolved",
      companyId: "c1",
      customerId: "cu3",
      customerName: "C",
      channel: "telefono",
      motivo: "facturacion",
      detail: "other",
      status: "resuelta",
      nextStep: null,
      attendedByEmployeeId: "e1",
      attendedByEmployeeName: "Op",
      activeManagementEmployeeId: null,
      activeManagementEmployeeName: null,
      activeManagementStartedAt: null,
      createdAt: "2026-07-18T10:00:00.000Z",
      updatedAt: "2026-07-18T13:00:00.000Z",
    },
  ]

  const query = {
    statusFilter: "resueltas_hoy",
    motivo: "consulta_tv",
    channel: "all",
    operationalCategory: null,
    workTray: null,
    createdDate: null,
    search: "",
  }

  const discovery = filterSharedInboxDiscoveryRows(rows, query, referenceDate)
  const counts = computeSharedInboxStatusFilterCounts(discovery, referenceDate)
  const filtered = filterSharedInboxRows(rows, query, referenceDate)

  assert.equal(counts.resueltas_hoy, 1)
  assert.equal(filtered.length, counts.resueltas_hoy)
  assert.deepEqual(
    filtered.map((row) => row.id),
    ["tv-resolved"]
  )
})

test("chip Todas + motivo incluye resueltas (mismo set que el contador)", () => {
  const referenceDate = new Date("2026-07-18T15:00:00.000Z")
  const rows = [
    {
      id: "tv-resolved",
      companyId: "c1",
      customerId: "cu1",
      customerName: "A",
      channel: "telefono",
      motivo: "consulta_tv",
      detail: "ok",
      status: "resuelta",
      nextStep: null,
      attendedByEmployeeId: "e1",
      attendedByEmployeeName: "Op",
      activeManagementEmployeeId: null,
      activeManagementEmployeeName: null,
      activeManagementStartedAt: null,
      createdAt: "2026-07-18T09:00:00.000Z",
      updatedAt: "2026-07-18T12:00:00.000Z",
    },
    {
      id: "tv-active",
      companyId: "c1",
      customerId: "cu2",
      customerName: "B",
      channel: "whatsapp",
      motivo: "consulta_tv",
      detail: "pending",
      status: "para_resolver",
      nextStep: "seguimiento_cliente",
      attendedByEmployeeId: "e1",
      attendedByEmployeeName: "Op",
      activeManagementEmployeeId: null,
      activeManagementEmployeeName: null,
      activeManagementStartedAt: null,
      createdAt: "2026-07-18T11:00:00.000Z",
      updatedAt: "2026-07-18T11:00:00.000Z",
    },
    {
      id: "other-resolved",
      companyId: "c1",
      customerId: "cu3",
      customerName: "C",
      channel: "telefono",
      motivo: "facturacion",
      detail: "other",
      status: "resuelta",
      nextStep: null,
      attendedByEmployeeId: "e1",
      attendedByEmployeeName: "Op",
      activeManagementEmployeeId: null,
      activeManagementEmployeeName: null,
      activeManagementStartedAt: null,
      createdAt: "2026-07-18T10:00:00.000Z",
      updatedAt: "2026-07-18T13:00:00.000Z",
    },
  ]

  const query = {
    statusFilter: "all",
    motivo: "consulta_tv",
    channel: "all",
    operationalCategory: null,
    workTray: null,
    createdDate: null,
    search: "",
  }

  const discovery = filterSharedInboxDiscoveryRows(rows, query, referenceDate)
  const counts = computeSharedInboxStatusFilterCounts(discovery, referenceDate)
  const filtered = filterSharedInboxRows(rows, query, referenceDate)

  assert.equal(counts.all, 2)
  assert.equal(filtered.length, counts.all)
  assert.deepEqual(
    filtered.map((row) => row.id).sort(),
    ["tv-active", "tv-resolved"]
  )
  assert.equal(counts.resueltas_hoy, 1)
})

test("Todas con motivo no se limita al día: incluye resueltas de jornadas anteriores", () => {
  const referenceDate = new Date("2026-07-18T15:00:00.000Z")
  const rows = [
    {
      id: "tv-old-resolved",
      companyId: "c1",
      customerId: "cu1",
      customerName: "A",
      channel: "telefono",
      motivo: "consulta_tv",
      detail: "ayer",
      status: "resuelta",
      nextStep: null,
      attendedByEmployeeId: "e1",
      attendedByEmployeeName: "Op",
      activeManagementEmployeeId: null,
      activeManagementEmployeeName: null,
      activeManagementStartedAt: null,
      createdAt: "2026-07-10T09:00:00.000Z",
      updatedAt: "2026-07-10T12:00:00.000Z",
    },
    {
      id: "tv-resolved-today",
      companyId: "c1",
      customerId: "cu2",
      customerName: "B",
      channel: "whatsapp",
      motivo: "consulta_tv",
      detail: "hoy",
      status: "resuelta",
      nextStep: null,
      attendedByEmployeeId: "e1",
      attendedByEmployeeName: "Op",
      activeManagementEmployeeId: null,
      activeManagementEmployeeName: null,
      activeManagementStartedAt: null,
      createdAt: "2026-07-18T09:00:00.000Z",
      updatedAt: "2026-07-18T12:00:00.000Z",
    },
    {
      id: "tv-active",
      companyId: "c1",
      customerId: "cu3",
      customerName: "C",
      channel: "telefono",
      motivo: "consulta_tv",
      detail: "pending",
      status: "para_resolver",
      nextStep: "seguimiento_cliente",
      attendedByEmployeeId: "e1",
      attendedByEmployeeName: "Op",
      activeManagementEmployeeId: null,
      activeManagementEmployeeName: null,
      activeManagementStartedAt: null,
      createdAt: "2026-07-17T11:00:00.000Z",
      updatedAt: "2026-07-17T11:00:00.000Z",
    },
  ]

  const query = {
    statusFilter: "all",
    motivo: "consulta_tv",
    channel: "all",
    operationalCategory: null,
    workTray: null,
    createdDate: null,
    search: "",
  }

  const discovery = filterSharedInboxDiscoveryRows(rows, query, referenceDate)
  const counts = computeSharedInboxStatusFilterCounts(discovery, referenceDate)
  const filtered = filterSharedInboxRows(rows, query, referenceDate)

  assert.equal(counts.all, 3)
  assert.equal(filtered.length, 3)
  assert.equal(counts.resueltas_hoy, 1)
  assert.ok(counts.all > counts.resueltas_hoy)
})

test("migración RC 3.1.6 mapea legacy y actualiza check", () => {
  const sql = readFileSync(
    join(
      __dirname,
      "../supabase/migrations/20261017000100_customer_atenciones_motivo_rc_3_1_6.sql"
    ),
    "utf8"
  )
  assert.match(sql, /WHEN 'consulta' THEN 'otro'/)
  assert.match(sql, /WHEN 'retencion' THEN 'baja'/)
  assert.match(sql, /'consulta_comercial'/)
  assert.match(sql, /'consulta_tv'/)
  const checkBlock = sql.slice(sql.indexOf("ADD CONSTRAINT"))
  assert.doesNotMatch(checkBlock, /'consulta'/)
  assert.doesNotMatch(checkBlock, /'retencion'/)
})

test("mapper acepta nuevos motivos", () => {
  const mapped = mapCustomerAtencionRowToCustomerAtencion({
    id: "a1",
    company_id: "c1",
    customer_id: "cu1",
    attended_by_employee_id: "e1",
    channel: "telefono",
    motivo: "nuevo_servicio",
    detail: "Instalación",
    resolution: "Pendiente",
    resultado: "requiere_seguimiento",
    status: "para_resolver",
    next_step: "contactar_cliente",
    active_management_employee_id: null,
    active_management_started_at: null,
    created_at: "2026-07-18T12:00:00.000Z",
    updated_at: "2026-07-18T12:00:00.000Z",
    deleted_at: null,
  })
  assert.equal(mapped.motivo, "nuevo_servicio")
})
