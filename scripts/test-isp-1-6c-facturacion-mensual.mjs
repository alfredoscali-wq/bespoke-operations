import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  ISP_BILLING_MONTHLY_PERIOD_BILLED,
  ISP_BILLING_RUN_MISSING_FISCAL,
  ISP_BILLING_RUN_MISSING_PRICE,
} from "../lib/isp/billing-constants.ts"
import {
  calculateMonthlyProration,
  billingPeriodEndIso,
  billingPeriodStartIso,
  daysInBillingMonth,
  previousBillingPeriod,
} from "../lib/isp/billing-proration.ts"
import {
  determineMonthlyDocumentType,
  evaluateServiceForMonthlyPeriod,
  evaluateServicesForMonthlyRun,
  groupBillingRunItems,
  summarizeBillingRunGroups,
} from "../lib/isp/billing-run-engine.ts"
import { ignoreClientCompanyId } from "../lib/isp/billing-integrity.ts"
import {
  canAccessIspBilling,
  canWriteIspBilling,
} from "../lib/isp/permissions.ts"
import { getPageMetaForProfile } from "../lib/navigation/profile-navigation.ts"
import {
  canAccessPathWithModules,
  createEmptyModuleVisibility,
} from "../lib/roles/app-modules.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const sql = read("supabase/migrations/20261141000100_isp_1_6c_facturacion_mensual.sql")
const sql16b = read("supabase/migrations/20261140000100_isp_1_6b_comprobantes.sql")
const sql16a = read("supabase/migrations/20261139000100_isp_1_6a_billing_company_settings.sql")
const queries = read("lib/isp/billing-run-queries.ts")
const engine = read("lib/isp/billing-run-engine.ts")
const proration = read("lib/isp/billing-proration.ts")
const confirmApi = read("app/api/isp/billing/runs/[id]/confirm/route.ts")
const prepareApi = read("app/api/isp/billing/runs/route.ts")
const cancelApi = read("app/api/isp/billing/runs/[id]/cancel/route.ts")
const screen = read("components/isp/isp-billing-monthly-screen.tsx")
const review = read("components/isp/isp-billing-monthly-review-screen.tsx")

const adminUser = {
  systemRole: "administrador",
  roleCode: "administrador",
  moduleVisibility: {},
}
const operatorUser = {
  systemRole: "operario",
  roleCode: "operario",
  moduleVisibility: createEmptyModuleVisibility(),
}

const juan = {
  id: "svc-ftth",
  customerId: "cus-juan",
  subscriberId: "sub-juan",
  customerName: "Juan Pérez",
  customerDni: "30111222",
  customerEmail: "juan@example.com",
  customerAddress: "Calle Falsa 123",
  customerLocality: "Córdoba",
  planName: "Fibra 100",
  catalogCode: "FTTH-100",
  monthlyFee: 30000,
  listPrice: 35000,
  activationDate: "2026-08-25",
  commercialStatus: "active",
}

test("1. Crear corrida", () => {
  assert.match(prepareApi, /prepareIspBillingRun/)
  assert.match(queries, /export async function prepareIspBillingRun/)
  assert.match(sql, /CREATE TABLE public.isp_billing_runs/)
  assert.match(screen, /Preparar facturación/)
})

test("2. Un período por empresa", () => {
  assert.match(sql, /CONSTRAINT isp_billing_runs_period_unique\s+UNIQUE \(company_id, period_year, period_month\)/)
})

test("3. No duplicar corrida confirmada", () => {
  assert.match(queries, /BillingRunConflictError/)
  assert.equal(ISP_BILLING_MONTHLY_PERIOD_BILLED, "Este período ya fue facturado.")
  assert.match(prepareApi, /status: 409/)
})

test("4. Servicio activo incluido", () => {
  const result = evaluateServiceForMonthlyPeriod({
    serviceId: "svc-1",
    planName: "FTTH-100",
    catalogCode: "FTTH-100",
    monthlyFee: 30000,
    activationDate: "2026-01-01",
    commercialStatus: "active",
    period: { year: 2026, month: 9 },
    previousPeriodAlreadyBilled: true,
  })
  assert.equal(result.include, true)
  assert.equal(result.monthlyAmount, 30000)
  assert.equal(result.status, "ready")
})

test("5. Servicio futuro excluido", () => {
  const result = evaluateServiceForMonthlyPeriod({
    serviceId: "svc-1",
    planName: "FTTH-100",
    monthlyFee: 30000,
    activationDate: "2026-10-01",
    commercialStatus: "active",
    period: { year: 2026, month: 9 },
    previousPeriodAlreadyBilled: false,
  })
  assert.equal(result.include, false)
  assert.equal(result.monthlyAmount, 0)
})

test("6. Servicio fuera de período / baja no se factura", () => {
  const result = evaluateServiceForMonthlyPeriod({
    serviceId: "svc-1",
    planName: "FTTH-100",
    monthlyFee: 30000,
    activationDate: "2026-01-01",
    commercialStatus: "cancelled",
    period: { year: 2026, month: 9 },
    previousPeriodAlreadyBilled: false,
  })
  assert.equal(result.include, true)
  assert.equal(result.monthlyAmount, 0)
  assert.equal(result.proportionalAmount, 0)
  assert.equal(result.status, "needs_review")
  assert.equal(result.requiresReview, true)
})

test("7. Precio contratado utilizado", () => {
  const result = evaluateServiceForMonthlyPeriod({
    serviceId: juan.id,
    planName: juan.planName,
    catalogCode: juan.catalogCode,
    monthlyFee: 30000,
    activationDate: "2026-08-25",
    commercialStatus: "active",
    period: { year: 2026, month: 9 },
    previousPeriodAlreadyBilled: false,
  })
  assert.equal(result.monthlyAmount, 30000)
})

test("8. Precio de lista no utilizado", () => {
  assert.doesNotMatch(proration, /listPrice|list_price/)
  assert.doesNotMatch(engine, /input\.listPrice/)
  const result = evaluateServiceForMonthlyPeriod({
    serviceId: juan.id,
    planName: juan.planName,
    catalogCode: juan.catalogCode,
    monthlyFee: 30000,
    activationDate: "2026-01-01",
    commercialStatus: "active",
    period: { year: 2026, month: 9 },
    previousPeriodAlreadyBilled: true,
  })
  assert.equal(result.monthlyAmount, 30000)
  assert.equal(result.monthlyAmount === 35000, false)
})

test("9. Alta día 1 sin proporcional", () => {
  const result = evaluateServiceForMonthlyPeriod({
    serviceId: "svc-1",
    planName: "FTTH-100",
    catalogCode: "FTTH-100",
    monthlyFee: 30000,
    activationDate: "2026-09-01",
    commercialStatus: "active",
    period: { year: 2026, month: 9 },
    previousPeriodAlreadyBilled: false,
  })
  assert.equal(result.monthlyAmount, 30000)
  assert.equal(result.proportionalAmount, 0)
  assert.equal(result.concepts.some((item) => item.kind === "proportional"), false)
})

test("10. Alta día 25 genera proporcional", () => {
  const result = evaluateServiceForMonthlyPeriod({
    serviceId: juan.id,
    planName: juan.planName,
    catalogCode: juan.catalogCode,
    monthlyFee: 30000,
    activationDate: "2026-08-25",
    commercialStatus: "active",
    period: { year: 2026, month: 9 },
    previousPeriodAlreadyBilled: false,
  })
  assert.equal(result.monthlyAmount, 30000)
  assert.equal(result.proportionalDays, 7)
  assert.equal(result.proportionalAmount, 6774.19)
  assert.ok(result.concepts.some((item) => item.description.includes("septiembre")))
  assert.ok(result.concepts.some((item) => item.description.includes("agosto")))
})

test("11. Cálculo de días correcto", () => {
  assert.equal(daysInBillingMonth({ year: 2026, month: 8 }), 31)
  const prorate = calculateMonthlyProration({
    monthlyAmount: 30000,
    activationDate: "2026-08-25",
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
  })
  assert.equal(prorate.billableDays, 7)
  assert.equal(prorate.periodDays, 31)
})

test("12. Redondeo a 2 decimales", () => {
  const prorate = calculateMonthlyProration({
    monthlyAmount: 30000,
    activationDate: "2026-08-25",
    periodStart: billingPeriodStartIso({ year: 2026, month: 8 }),
    periodEnd: billingPeriodEndIso({ year: 2026, month: 8 }),
  })
  assert.equal(prorate.amount, 6774.19)
  assert.equal(Number(prorate.amount.toFixed(2)), prorate.amount)
})

test("13. Varios servicios del mismo abonado", () => {
  const wireless = {
    ...juan,
    id: "svc-wireless",
    planName: "Wireless 20",
    catalogCode: "Wireless-20",
    monthlyFee: 15000,
    listPrice: 18000,
    activationDate: "2026-01-01",
  }
  const items = evaluateServicesForMonthlyRun({
    services: [juan, wireless],
    period: { year: 2026, month: 9 },
    issuerVatCondition: "responsable_inscripto",
    issuerReady: true,
    pointOfSaleReady: true,
    previousBilledServiceIds: [],
  })
  assert.equal(items.length, 2)
  assert.equal(new Set(items.map((item) => item.customerId)).size, 1)
})

test("14. Conceptos agrupables en un comprobante", () => {
  const wireless = {
    ...juan,
    id: "svc-wireless",
    planName: "Wireless 20",
    catalogCode: "Wireless-20",
    monthlyFee: 15000,
    activationDate: "2026-01-01",
  }
  const raw = evaluateServicesForMonthlyRun({
    services: [juan, wireless],
    period: { year: 2026, month: 9 },
    issuerVatCondition: "responsable_inscripto",
    issuerReady: true,
    pointOfSaleReady: true,
  })
  const groups = groupBillingRunItems(
    raw.map((item, index) => ({
      ...item,
      id: `item-${index}`,
      runId: "run-1",
      companyId: "co-1",
      createdAt: "",
    }))
  )
  assert.equal(groups.length, 1)
  assert.ok(groups[0].concepts.length >= 3)
  assert.equal(groups[0].monthlyAmount, 45000)
})

test("15. Determinación A/B/C", () => {
  assert.equal(
    determineMonthlyDocumentType({
      issuerVatCondition: "responsable_inscripto",
      customerName: "Juan Pérez",
      customerDocumentNumber: "30111222",
    }).documentType,
    "factura_b"
  )
  assert.equal(
    determineMonthlyDocumentType({
      issuerVatCondition: "responsable_inscripto",
      customerName: "Acme SA",
      customerDocumentNumber: "20-12345678-6",
    }).documentType,
    "factura_a"
  )
  assert.equal(
    determineMonthlyDocumentType({
      issuerVatCondition: "monotributo",
      customerName: "Juan Pérez",
      customerDocumentNumber: "30111222",
    }).documentType,
    "factura_c"
  )
})

test("16. Cliente sin datos fiscales genera error", () => {
  const result = determineMonthlyDocumentType({
    issuerVatCondition: "responsable_inscripto",
    customerName: "Juan Pérez",
    customerDocumentNumber: "",
  })
  assert.equal(result.errorMessage, ISP_BILLING_RUN_MISSING_FISCAL)
  const items = evaluateServicesForMonthlyRun({
    services: [{ ...juan, customerDni: "" }],
    period: { year: 2026, month: 9 },
    issuerVatCondition: "responsable_inscripto",
    issuerReady: true,
    pointOfSaleReady: true,
  })
  assert.equal(items[0]?.status, "error")
})

test("17. Servicio sin precio genera error", () => {
  const result = evaluateServiceForMonthlyPeriod({
    serviceId: "svc-1",
    planName: "FTTH-100",
    monthlyFee: null,
    activationDate: "2026-01-01",
    commercialStatus: "active",
    period: { year: 2026, month: 9 },
    previousPeriodAlreadyBilled: false,
  })
  assert.equal(result.status, "error")
  assert.equal(result.errorMessage, ISP_BILLING_RUN_MISSING_PRICE)
})

test("18. Proporcional genera advertencia", () => {
  const result = evaluateServiceForMonthlyPeriod({
    serviceId: juan.id,
    planName: juan.planName,
    catalogCode: juan.catalogCode,
    monthlyFee: 30000,
    activationDate: "2026-08-25",
    commercialStatus: "active",
    period: { year: 2026, month: 9 },
    previousPeriodAlreadyBilled: false,
  })
  assert.match(result.warningCode ?? "", /proportional/)
  assert.match(result.warningMessage ?? "", /proporcional/i)
  const groups = groupBillingRunItems(
    evaluateServicesForMonthlyRun({
      services: [juan],
      period: { year: 2026, month: 9 },
      issuerVatCondition: "responsable_inscripto",
      issuerReady: true,
      pointOfSaleReady: true,
    }).map((item) => ({
      ...item,
      id: "item-1",
      runId: "run-1",
      companyId: "co-1",
      createdAt: "",
    }))
  )
  const summary = summarizeBillingRunGroups(groups)
  assert.equal(summary.proportionalDocuments, 1)
  assert.equal(summary.warningsCount, 0)
  assert.equal(summary.canConfirm, true)
})

test("19. Error bloquea confirmación", () => {
  const raw = evaluateServicesForMonthlyRun({
    services: [{ ...juan, monthlyFee: null }],
    period: { year: 2026, month: 9 },
    issuerVatCondition: "responsable_inscripto",
    issuerReady: true,
    pointOfSaleReady: true,
  })
  const groups = groupBillingRunItems(
    raw.map((item) => ({
      ...item,
      id: "item-1",
      runId: "run-1",
      companyId: "co-1",
      createdAt: "",
    }))
  )
  const summary = summarizeBillingRunGroups(groups)
  assert.equal(summary.canConfirm, false)
  assert.equal(summary.errorsCount, 1)
  assert.match(review, /disabled=\{!detail.canConfirm/)
})

test("20. Cancelar no genera comprobantes", () => {
  assert.match(cancelApi, /cancelIspBillingRun/)
  assert.match(queries, /status: "cancelled"/)
  assert.doesNotMatch(
    read("lib/isp/billing-run-queries.ts").split("export async function cancelIspBillingRun")[1].split("export async function confirmIspBillingRun")[0],
    /createIspBillingDocument|issueIspBillingDocument/
  )
})

test("21. Confirmar genera comprobantes", () => {
  assert.match(confirmApi, /confirmIspBillingRun/)
  assert.match(queries, /createIspBillingDocument/)
  assert.match(queries, /issueIspBillingDocument/)
})

test("22. billing_run_id queda asociado al comprobante", () => {
  assert.match(queries, /billingRunId: runId/)
  assert.match(sql, /ADD COLUMN IF NOT EXISTS billing_run_id/)
  assert.match(read("lib/isp/billing-document-queries.ts"), /billing_run_id: draft.billingRunId/)
})

test("23. No duplicar comprobantes", () => {
  assert.match(sql, /isp_billing_documents_run_customer_unique/)
  assert.match(queries, /item.documentId/)
  assert.match(sql, /UNIQUE \(run_id, service_id\)/)
})

test("24. Multi-tenant", () => {
  assert.equal(ignoreClientCompanyId("co-session", "co-attacker"), "co-session")
  assert.match(queries, /ignoreClientCompanyId/)
  assert.match(sql, /enforce_isp_billing_run_company_match/)
})

test("25. RLS", () => {
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /company_id = public.auth_user_company_id\(\)/)
  assert.match(sql, /auth_user_has_allowed_module\('facturacion'\)/)
})

test("26. Permisos", () => {
  assert.equal(canAccessIspBilling(adminUser), true)
  assert.equal(canWriteIspBilling(operatorUser), false)
  assert.equal(canAccessPathWithModules("/facturacion/mensual", createEmptyModuleVisibility()), false)
  assert.equal(
    canAccessPathWithModules("/facturacion/mensual", {
      ...createEmptyModuleVisibility(),
      facturacion: true,
    }),
    true
  )
  assert.match(prepareApi, /requireIspBillingWriteContext/)
})

test("27. Regresión ISP 1.6A", () => {
  assert.match(sql16a, /isp_billing_company_settings/)
  assert.doesNotMatch(sql, /ALTER TABLE public\.isp_billing_point_of_sales/)
  assert.match(sql, /auto_prepare_day_one/)
  assert.match(sql, /never auto-prepares/i)
})

test("28. Regresión ISP 1.6B", () => {
  assert.match(sql16b, /isp_billing_documents/)
  assert.match(sql16b, /issue_isp_billing_document/)
  assert.doesNotMatch(sql, /wsfe|wsaa|siro\.com/)
  assert.doesNotMatch(queries, /wsfe|siro\.com|pg_cron/)
  assert.match(queries, /issueIspBillingDocument/)
  assert.equal(
    getPageMetaForProfile("/facturacion/mensual", "administrador").title,
    "Facturación mensual"
  )
  assert.equal(previousBillingPeriod({ year: 2026, month: 9 }).month, 8)
})
