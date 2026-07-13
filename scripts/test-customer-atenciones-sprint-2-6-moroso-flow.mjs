import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  computeOperationalWorkCounts,
  filterSharedInboxRows,
  getOperationalCategoryForNextStep,
  matchesOperationalCategory,
  SHARED_INBOX_OPERATIONAL_CATEGORY_CONFIG,
} from "../lib/customer-atenciones/shared-inbox.ts"
import {
  isMorosoConsultation,
  MOROSO_NEXT_STEP,
  MOROSO_TRACKING_STATUS_LABELS,
  validateMorosoTrackingStatus,
} from "../lib/customer-atenciones/moroso-flow.ts"
import {
  parseMorosoTrackingRpcResult,
  mapMorosoTrackingRpcError,
} from "../lib/customer-atenciones/moroso-management.ts"
import { formatCustomerAtencionNextStepLabel } from "../lib/customer-atenciones/format.ts"
import { CONSULTATION_INTERNAL_ACTION_NEXT_STEPS } from "../lib/customer-atenciones/consultation.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))

const migrationPath = join(
  __dirname,
  "../supabase/migrations/20261010000100_customer_atenciones_sprint_2_6_moroso_flow.sql"
)
const detailPath = join(
  __dirname,
  "../components/atencion-cliente/atencion-detail-screen.tsx"
)
const operationalSectionPath = join(
  __dirname,
  "../components/atencion-cliente/consultation-operational-work-section.tsx"
)
const morosoBlockPath = join(
  __dirname,
  "../components/atencion-cliente/moroso-tracking-block.tsx"
)
const morosoRoutePath = join(
  __dirname,
  "../app/api/atencion-cliente/[atencionId]/moroso-tracking/route.ts"
)
const providerPath = join(
  __dirname,
  "../components/atencion-cliente/atencion-cliente-provider.tsx"
)

const migrationSql = readFileSync(migrationPath, "utf8")
const detailSource = readFileSync(detailPath, "utf8")
const operationalSectionSource = readFileSync(operationalSectionPath, "utf8")
const morosoBlockSource = readFileSync(morosoBlockPath, "utf8")
const morosoRouteSource = readFileSync(morosoRoutePath, "utf8")
const providerSource = readFileSync(providerPath, "utf8")

function inboxRow(overrides) {
  return {
    id: "row-1",
    customerId: "customer-1",
    customerName: "Juan Pérez",
    channel: "whatsapp",
    motivo: "facturacion",
    detail: "Consulta morosos",
    status: "para_resolver",
    nextStep: MOROSO_NEXT_STEP,
    attendedByEmployeeId: "employee-1",
    attendedByEmployeeName: "Cintia",
    activeManagementEmployeeId: null,
    activeManagementEmployeeName: null,
    activeManagementStartedAt: null,
    createdAt: "2026-07-12T10:00:00.000Z",
    updatedAt: "2026-07-12T10:00:00.000Z",
    ...overrides,
  }
}

test("1. próximo paso Derivar Administración - Morosos está en continuar gestión", () => {
  assert.equal(MOROSO_NEXT_STEP, "derivar_admin_morosos")
  assert.ok(
    CONSULTATION_INTERNAL_ACTION_NEXT_STEPS.includes(MOROSO_NEXT_STEP)
  )
  assert.equal(
    formatCustomerAtencionNextStepLabel(MOROSO_NEXT_STEP),
    "Derivar Administración - Morosos"
  )
})

test("2. derivar_admin_morosos clasifica en morosos (first-match = administracion)", () => {
  assert.equal(
    getOperationalCategoryForNextStep(MOROSO_NEXT_STEP),
    "administracion"
  )
  assert.equal(
    matchesOperationalCategory(
      { status: "para_resolver", nextStep: MOROSO_NEXT_STEP },
      "morosos"
    ),
    true
  )
  assert.equal(SHARED_INBOX_OPERATIONAL_CATEGORY_CONFIG.morosos.label, "Morosos")
  assert.deepEqual(
    [...SHARED_INBOX_OPERATIONAL_CATEGORY_CONFIG.morosos.nextSteps],
    ["derivar_admin_morosos"]
  )
})

test("3. KPI morosos cuenta solo consultas activas con ese próximo paso", () => {
  const counts = computeOperationalWorkCounts([
    inboxRow({ status: "para_resolver" }),
    inboxRow({ id: "row-2", status: "resuelta" }),
    inboxRow({
      id: "row-3",
      nextStep: "derivar_admin_facturacion",
      status: "para_resolver",
    }),
  ])

  assert.equal(counts.morosos, 1)
  assert.equal(counts.administracion, 2)
})

test("4. filtro operativo morosos lista consultas del circuito", () => {
  const rows = [
    inboxRow({ id: "moroso-1" }),
    inboxRow({
      id: "admin-1",
      nextStep: "derivar_admin_facturacion",
    }),
  ]

  const filtered = filterSharedInboxRows(rows, {
    statusFilter: "all",
    operationalCategory: "morosos",
  })

  assert.equal(filtered.length, 1)
  assert.equal(filtered[0].id, "moroso-1")
  assert.equal(matchesOperationalCategory(filtered[0], "morosos"), true)
})

test("5. isMorosoConsultation identifica el circuito", () => {
  assert.equal(isMorosoConsultation({ nextStep: MOROSO_NEXT_STEP }), true)
  assert.equal(
    isMorosoConsultation({ nextStep: "derivar_admin_facturacion" }),
    false
  )
})

test("6. migración agrega columna, constraints y RPC de seguimiento", () => {
  assert.match(migrationSql, /moroso_tracking_status/)
  assert.match(migrationSql, /facturacion_morosos/)
  assert.match(migrationSql, /update_customer_atencion_moroso_tracking/)
  assert.match(migrationSql, /cupon_pendiente_enviar/)
  assert.match(migrationSql, /servicio_rehabilitado/)
})

test("7. defer a morosos inicializa seguimiento en cupón pendiente", () => {
  assert.match(
    migrationSql,
    /WHEN v_next_step = 'facturacion_morosos' THEN 'cupon_pendiente_enviar'/
  )
})

test("8. resolve limpia moroso_tracking_status", () => {
  assert.match(migrationSql, /moroso_tracking_status = NULL/)
})

test("9. estados de seguimiento tienen etiquetas UI", () => {
  assert.equal(
    MOROSO_TRACKING_STATUS_LABELS.cupon_pendiente_enviar,
    "Cupón pendiente de enviar"
  )
  assert.equal(
    MOROSO_TRACKING_STATUS_LABELS.servicio_rehabilitado,
    "Servicio rehabilitado"
  )
})

test("10. validación de tracking rechaza valores inválidos", () => {
  assert.ok("error" in validateMorosoTrackingStatus(""))
  assert.equal(validateMorosoTrackingStatus("cupon_enviado"), "cupon_enviado")
})

test("11. parse RPC de seguimiento moroso", () => {
  const parsed = parseMorosoTrackingRpcResult({
    atencion_id: "atencion-1",
    previous_tracking_status: "cupon_pendiente_enviar",
    new_tracking_status: "cupon_enviado",
  })

  assert.deepEqual(parsed, {
    atencionId: "atencion-1",
    previousTrackingStatus: "cupon_pendiente_enviar",
    newTrackingStatus: "cupon_enviado",
  })
})

test("12. errores RPC de seguimiento mapean mensajes claros", () => {
  assert.equal(
    mapMorosoTrackingRpcError("MOROSO_TRACKING_NOT_APPLICABLE").code,
    "MOROSO_TRACKING_NOT_APPLICABLE"
  )
})

test("13. detalle muestra bloque de seguimiento morosos", () => {
  assert.match(detailSource, /MorosoTrackingBlock/)
  assert.match(detailSource, /isMorosoConsultation/)
})

test("14. KPI secundario Morosos en trabajo por resolver", () => {
  assert.match(operationalSectionSource, /morosos: Receipt/)
  assert.match(operationalSectionSource, /morosos: "orange"/)
})

test("15. bloque de seguimiento ofrece los cinco estados", () => {
  assert.match(morosoBlockSource, /MOROSO_TRACKING_STATUS_OPTIONS/)
  assert.match(morosoBlockSource, /updateMorosoTracking/)
})

test("16. API moroso-tracking usa auth compartida del módulo", () => {
  assert.match(morosoRouteSource, /requireAtencionClienteMutationContext/)
  assert.match(morosoRouteSource, /updateCustomerAtencionMorosoTracking/)
})

test("17. provider expone updateMorosoTracking", () => {
  assert.match(providerSource, /updateMorosoTrackingManagement/)
  assert.match(providerSource, /updateMorosoTracking:/)
})
