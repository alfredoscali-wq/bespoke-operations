import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import {
  CONSULTATION_EXTERNAL_WAIT_NEXT_STEPS,
  CONSULTATION_PARA_RESOLVER_KPI_NEXT_STEPS,
  CUSTOMER_ATENCION_NEXT_STEP_VALUES,
  resolveInitialConsultationStatusFromNextStep,
} from "../lib/customer-atenciones/consultation.ts"
import {
  CUSTOMER_ATENCION_NEXT_STEP_OPTIONS,
  formatCustomerAtencionNextStepLabel,
} from "../lib/customer-atenciones/format.ts"
import {
  computeOperationalWorkCounts,
  computeSharedInboxKpis,
  filterSharedInboxRows,
  SHARED_INBOX_OPERATIONAL_CATEGORY_CONFIG,
} from "../lib/customer-atenciones/shared-inbox.ts"
import {
  isAdministrationConsultation,
  mapAdministrationOutcomeToAction,
} from "../lib/customer-atenciones/administration-flow.ts"
import { RETENTION_FIRM_BAJA_NEXT_STEP } from "../lib/customer-atenciones/retention-flow.ts"
import { MOROSO_NEXT_STEP } from "../lib/customer-atenciones/moroso-flow.ts"
import {
  isTechnicalConsultation,
  mapTechnicalOutcomeToAction,
} from "../lib/customer-atenciones/technical-flow.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationPath = join(
  __dirname,
  "../supabase/migrations/20261011000100_customer_atenciones_sprint_2_8_next_step_restructure.sql"
)
const formPath = join(
  __dirname,
  "../components/atencion-cliente/atencion-form-dialog.tsx"
)
const detailPath = join(
  __dirname,
  "../components/atencion-cliente/atencion-detail-screen.tsx"
)

const migrationSql = readFileSync(migrationPath, "utf8")
const formSource = readFileSync(formPath, "utf8")
const detailSource = readFileSync(detailPath, "utf8")
const referenceDate = new Date("2026-07-13T15:00:00.000Z")

function inboxRow(overrides) {
  return {
    id: "row-1",
    customerId: "customer-1",
    customerName: "Juan Pérez",
    channel: "whatsapp",
    motivo: "facturacion",
    detail: "Consulta",
    status: "para_resolver",
    nextStep: "derivar_admin_facturacion",
    attendedByEmployeeId: "employee-1",
    attendedByEmployeeName: "Cintia",
    activeManagementEmployeeId: null,
    activeManagementEmployeeName: null,
    activeManagementStartedAt: null,
    createdAt: "2026-07-13T10:00:00.000Z",
    updatedAt: "2026-07-13T10:00:00.000Z",
    ...overrides,
  }
}

test("1. vocabulary Sprint 2.8 sin opciones eliminadas", () => {
  const values = CUSTOMER_ATENCION_NEXT_STEP_VALUES
  assert.ok(values.includes("resolver_consulta_tecnica"))
  assert.ok(values.includes("derivar_admin_facturacion"))
  assert.ok(values.includes("derivar_admin_morosos"))
  assert.ok(values.includes("derivar_admin_gestion"))
  assert.ok(values.includes("seguimiento_cliente"))
  assert.ok(!values.includes("resolver_facturacion"))
  assert.ok(!values.includes("analizar_problema_tecnico"))
  assert.ok(!values.includes("esperar_administracion"))
  assert.ok(!values.includes("coordinar_retiro"))
  assert.ok(!values.includes("facturacion_morosos"))
})

test("2. labels de Próximo Paso", () => {
  assert.equal(
    formatCustomerAtencionNextStepLabel("resolver_consulta_tecnica"),
    "Resolver consulta técnica"
  )
  assert.equal(
    formatCustomerAtencionNextStepLabel("derivar_admin_morosos"),
    "Derivar Administración - Morosos"
  )
  assert.equal(CUSTOMER_ATENCION_NEXT_STEP_OPTIONS.length, 9)
})

test("3. solo esperar_cliente es Pendiente / espera externa", () => {
  assert.deepEqual([...CONSULTATION_EXTERNAL_WAIT_NEXT_STEPS], ["esperar_cliente"])
  assert.equal(resolveInitialConsultationStatusFromNextStep("esperar_cliente"), "pendiente")
  assert.equal(
    resolveInitialConsultationStatusFromNextStep("derivar_admin_gestion"),
    "para_resolver"
  )
  assert.equal(
    resolveInitialConsultationStatusFromNextStep("seguimiento_cliente"),
    "para_resolver"
  )
})

test("4. Para Resolver incluye trabajo interno de cualquier área", () => {
  assert.ok(CONSULTATION_PARA_RESOLVER_KPI_NEXT_STEPS.includes("resolver_consulta_tecnica"))
  assert.ok(CONSULTATION_PARA_RESOLVER_KPI_NEXT_STEPS.includes("derivar_admin_morosos"))
  assert.ok(CONSULTATION_PARA_RESOLVER_KPI_NEXT_STEPS.includes("seguimiento_cliente"))
  assert.ok(CONSULTATION_PARA_RESOLVER_KPI_NEXT_STEPS.includes("generar_ot"))
})

test("5. KPI Administración incluye morosos; KPI Morosos es específico", () => {
  assert.deepEqual(
    [...SHARED_INBOX_OPERATIONAL_CATEGORY_CONFIG.administracion.nextSteps].sort(),
    [
      "derivar_admin_facturacion",
      "derivar_admin_gestion",
      "derivar_admin_morosos",
    ].sort()
  )
  assert.deepEqual(
    [...SHARED_INBOX_OPERATIONAL_CATEGORY_CONFIG.morosos.nextSteps],
    ["derivar_admin_morosos"]
  )

  const counts = computeOperationalWorkCounts([
    inboxRow({ id: "m1", nextStep: MOROSO_NEXT_STEP }),
  ])
  assert.equal(counts.morosos, 1)
  assert.equal(counts.administracion, 1)
})

test("6. KPI Técnica y Pendiente de generar OT", () => {
  assert.deepEqual(
    [...SHARED_INBOX_OPERATIONAL_CATEGORY_CONFIG.tecnica.nextSteps],
    ["resolver_consulta_tecnica"]
  )
  assert.deepEqual(
    [...SHARED_INBOX_OPERATIONAL_CATEGORY_CONFIG.generar_ot.nextSteps],
    ["generar_ot"]
  )

  const counts = computeOperationalWorkCounts([
    inboxRow({ id: "t1", nextStep: "resolver_consulta_tecnica" }),
    inboxRow({ id: "ot1", nextStep: "generar_ot" }),
  ])
  assert.equal(counts.tecnica, 1)
  assert.equal(counts.generar_ot, 1)
})

test("7. retención firme baja deriva a administración gestión", () => {
  assert.equal(RETENTION_FIRM_BAJA_NEXT_STEP, "derivar_admin_gestion")
})

test("8. administración y técnica outcomes", () => {
  assert.equal(isAdministrationConsultation({ nextStep: "derivar_admin_facturacion" }), true)
  assert.equal(isTechnicalConsultation({ nextStep: "resolver_consulta_tecnica" }), true)
  assert.deepEqual(mapAdministrationOutcomeToAction("seguimiento_con_cliente"), {
    kind: "defer",
    nextStep: "seguimiento_cliente",
  })
  assert.deepEqual(mapTechnicalOutcomeToAction("pendiente_generar_ot"), {
    kind: "defer",
    nextStep: "generar_ot",
  })
})

test("9. filtros KPI alineados", () => {
  const rows = [
    inboxRow({ id: "adm", nextStep: "derivar_admin_facturacion" }),
    inboxRow({ id: "ext", status: "pendiente", nextStep: "esperar_cliente" }),
    inboxRow({ id: "ot", nextStep: "generar_ot" }),
  ]

  assert.equal(
    filterSharedInboxRows(rows, { statusFilter: "para_resolver" }, referenceDate).length,
    2
  )
  assert.equal(
    filterSharedInboxRows(rows, { statusFilter: "pendiente" }, referenceDate).length,
    1
  )
  assert.equal(
    filterSharedInboxRows(
      rows,
      { statusFilter: "all", operationalCategory: "generar_ot" },
      referenceDate
    ).length,
    1
  )
})

test("10. migración remapea valores y agrega link OT", () => {
  assert.match(migrationSql, /derivar_admin_morosos/)
  assert.match(migrationSql, /resolver_consulta_tecnica/)
  assert.match(migrationSql, /linked_task_id/)
  assert.match(migrationSql, /link_customer_atencion_to_task/)
  assert.match(migrationSql, /WHEN 'esperar_administracion' THEN 'derivar_admin_gestion'/)
  assert.match(migrationSql, /WHEN v_next_step = 'esperar_cliente' THEN 'pendiente'/)
})

test("11. UI usa Próximo paso", () => {
  assert.match(formSource, /Continuar con próximo paso|Próximo paso/)
  assert.match(detailSource, /Definir próximo paso|Próximo paso/)
  assert.match(detailSource, /TechnicalResultDialog|OtLinkBlock/)
})

test("12. Nuevas KPI documentado / creado hoy", () => {
  const kpis = computeSharedInboxKpis(
    [
      inboxRow({ createdAt: "2026-07-13T08:00:00.000Z" }),
      inboxRow({ id: "old", createdAt: "2026-07-12T08:00:00.000Z" }),
    ],
    referenceDate
  )
  assert.equal(kpis.nuevas, 1)
})
