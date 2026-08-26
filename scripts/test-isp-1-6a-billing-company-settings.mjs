import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  ISP_BILLING_ARCA_PENDING_LABEL,
  ISP_BILLING_COMPANY_READY_LABEL,
  ISP_BILLING_CUIT_INVALID_MESSAGE,
  ISP_BILLING_CUIT_REQUIRED_MESSAGE,
  ISP_BILLING_DOCUMENT_TYPES,
  ISP_BILLING_FORBIDDEN_MESSAGE,
  ISP_BILLING_LEGAL_NAME_REQUIRED_MESSAGE,
  ISP_BILLING_POS_DUPLICATE_MESSAGE,
  ISP_BILLING_POS_READY_LABEL,
  ISP_BILLING_POS_REQUIRED_MESSAGE,
  ISP_BILLING_SAVED_MESSAGE,
  ISP_BILLING_SEQUENCE_LOCKED_MESSAGE,
  ISP_BILLING_SIRO_PENDING_LABEL,
  ISP_BILLING_VAT_CONDITIONS,
  ISP_BILLING_VAT_REQUIRED_MESSAGE,
} from "../lib/isp/billing-constants.ts"
import {
  buildBillingConfigurationStatus,
  canAccessBillingCompany,
  canEditDocumentSequence,
  emptyBillingDraft,
  findDuplicatePosNumber,
  ignoreClientCompanyId,
  isValidArCuit,
  parsePointOfSaleNumber,
  settingsToDraft,
  validateBillingCompanyDraft,
} from "../lib/isp/billing-integrity.ts"
import {
  canAccessIspBilling,
  canWriteIspBilling,
} from "../lib/isp/permissions.ts"
import { APP_MODULE_KEYS } from "../lib/roles/app-modules.ts"
import { canAccessPathWithModules } from "../lib/roles/app-modules.ts"
import { createEmptyModuleVisibility } from "../lib/roles/app-modules.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const sql = read(
  "supabase/migrations/20261139000100_isp_1_6a_billing_company_settings.sql"
)
const sqlPrevious = read(
  "supabase/migrations/20261138000100_isp_1_5_abonado_eliminacion_admin.sql"
)
const settingsApi = read("app/api/isp/billing/settings/route.ts")
const posApi = read("app/api/isp/billing/point-of-sale/route.ts")
const statusApi = read("app/api/isp/billing/status/route.ts")
const queries = read("lib/isp/billing-queries.ts")
const screen = read("components/isp/isp-billing-settings-screen.tsx")
const VALID_CUIT = "20-12345678-6"
const INVALID_CUIT = "20-12345678-0"

function completeDraft(overrides = {}) {
  return {
    ...emptyBillingDraft(),
    legalName: "Bespoke Operations S.A.",
    taxId: VALID_CUIT,
    vatCondition: "responsable_inscripto",
    taxAddress: "Av. Siempre Viva 123",
    city: "Córdoba",
    province: "Córdoba",
    postalCode: "5000",
    ...overrides,
  }
}

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

test("1. Crear configuración usa upsert por company_id de sesión", () => {
  assert.match(settingsApi, /upsertIspBillingSettings/)
  assert.match(queries, /upsert\(/)
  assert.match(queries, /onConflict: "company_id"/)
  assert.match(sql, /isp_billing_company_settings_company_unique/)
  assert.equal(isValidArCuit(VALID_CUIT), true)
})

test("2. company_id correcto y nunca se toma del frontend", () => {
  assert.equal(
    ignoreClientCompanyId("co-session", "co-attacker"),
    "co-session"
  )
  assert.match(queries, /ignoreClientCompanyId/)
  assert.match(settingsApi, /auth\.companyId/)
  assert.doesNotMatch(settingsApi, /body\.companyId\s*=/)
})

test("3. Una sola configuración por empresa", () => {
  assert.match(sql, /CONSTRAINT isp_billing_company_settings_company_unique UNIQUE \(company_id\)/)
  assert.doesNotMatch(sql, /empresa_facturadora_id/)
})

test("4. CUIT obligatorio", () => {
  const issues = validateBillingCompanyDraft(
    completeDraft({ taxId: "" })
  )
  assert.ok(issues.some((issue) => issue.message === ISP_BILLING_CUIT_REQUIRED_MESSAGE))
})

test("5. CUIT inválido rechazado", () => {
  assert.equal(isValidArCuit(INVALID_CUIT), false)
  const issues = validateBillingCompanyDraft(
    completeDraft({ taxId: INVALID_CUIT })
  )
  assert.ok(issues.some((issue) => issue.message === ISP_BILLING_CUIT_INVALID_MESSAGE))
  assert.match(sql, /is_valid_ar_cuit/)
})

test("6. Razón social obligatoria", () => {
  const issues = validateBillingCompanyDraft(completeDraft({ legalName: "  " }))
  assert.ok(
    issues.some((issue) => issue.message === ISP_BILLING_LEGAL_NAME_REQUIRED_MESSAGE)
  )
})

test("7. Condición IVA obligatoria y controlada", () => {
  const issues = validateBillingCompanyDraft(completeDraft({ vatCondition: "" }))
  assert.ok(issues.some((issue) => issue.message === ISP_BILLING_VAT_REQUIRED_MESSAGE))
  assert.deepEqual(ISP_BILLING_VAT_CONDITIONS, [
    "responsable_inscripto",
    "monotributo",
    "exento",
    "consumidor_final",
  ])
  assert.match(sql, /responsable_inscripto/)
  assert.doesNotMatch(sql, /iva_no_responsable|sujeto_no_categorizado/)
})

test("8. Punto de venta", () => {
  assert.equal(parsePointOfSaleNumber("0003"), 3)
  assert.equal(parsePointOfSaleNumber("abc"), null)
  assert.match(sql, /isp_billing_point_of_sales/)
  assert.match(posApi, /upsertIspBillingPointOfSale/)
  assert.match(screen, /Punto de venta/)
})

test("9. No duplicar punto de venta", () => {
  assert.equal(
    findDuplicatePosNumber({
      companyId: "co-1",
      number: 3,
      currentId: "pos-1",
      existing: [
        { id: "pos-1", companyId: "co-1", number: 3 },
        { id: "pos-2", companyId: "co-1", number: 4 },
      ],
    }),
    false
  )
  assert.equal(
    findDuplicatePosNumber({
      companyId: "co-1",
      number: 4,
      currentId: "pos-1",
      existing: [
        { id: "pos-1", companyId: "co-1", number: 3 },
        { id: "pos-2", companyId: "co-1", number: 4 },
      ],
    }),
    true
  )
  assert.equal(ISP_BILLING_POS_DUPLICATE_MESSAGE.includes("punto de venta"), true)
  assert.match(sql, /isp_billing_point_of_sales_company_number_unique/)
})

test("10. Configuración ARCA inicialmente pendiente", () => {
  const status = buildBillingConfigurationStatus({
    settings: null,
  })
  assert.equal(status.arcaStatus, "not_configured")
  assert.equal(status.labels.arca, ISP_BILLING_ARCA_PENDING_LABEL)
  assert.match(screen, /Configurar ARCA/)
  assert.match(screen, /disabled/)
  assert.doesNotMatch(screen, /fetch\("https:\/\/.*arca/)
  assert.doesNotMatch(sql, /private_key|client_secret|cert_pem/)
})

test("11. Configuración SIRO inicialmente pendiente", () => {
  const status = buildBillingConfigurationStatus({ settings: null })
  assert.equal(status.siroStatus, "not_configured")
  assert.equal(status.labels.siro, ISP_BILLING_SIRO_PENDING_LABEL)
  assert.match(screen, /ISP_BILLING_SIRO_HELP/)
  assert.match(
    read("lib/isp/billing-constants.ts"),
    /SIRO se configurará posteriormente/
  )
  assert.doesNotMatch(queries, /siro\.com|api\.siro/)
})

test("12. Usuario de otra empresa no puede acceder", () => {
  assert.equal(canAccessBillingCompany("co-1", "co-2"), false)
  assert.equal(canAccessBillingCompany("co-1", "co-1"), true)
  assert.match(sql, /company_id = public.auth_user_company_id\(\)/)
  assert.match(queries, /\.eq\("company_id", companyId\)/)
})

test("13. Usuario sin permisos no puede modificar", () => {
  assert.equal(canAccessIspBilling(adminUser), true)
  assert.equal(canWriteIspBilling(adminUser), true)
  assert.equal(canAccessIspBilling(operatorUser), false)
  assert.equal(canWriteIspBilling(operatorUser), false)
  assert.equal(
    canAccessPathWithModules(
      "/configuracion/facturacion",
      createEmptyModuleVisibility()
    ),
    false
  )
  assert.equal(
    canAccessPathWithModules(
      "/facturacion/configuracion",
      createEmptyModuleVisibility()
    ),
    false
  )
  assert.match(sql, /auth_user_has_allowed_module\('facturacion'\)/)
  assert.equal(ISP_BILLING_FORBIDDEN_MESSAGE.length > 0, true)
})

test("14. Actualizar configuración", () => {
  assert.match(settingsApi, /export async function PUT/)
  assert.match(settingsApi, /export async function POST/)
  assert.equal(ISP_BILLING_SAVED_MESSAGE, "Configuración guardada correctamente")
  assert.match(screen, /Guardar configuración/)
  const draft = settingsToDraft(null)
  assert.equal(draft.legalName, "")
})

test("15. Logo opcional", () => {
  const issues = validateBillingCompanyDraft(completeDraft({ logoUrl: "" }))
  assert.equal(
    issues.some((issue) => issue.field === "logoUrl"),
    false
  )
  assert.match(screen, /Opcional/)
  assert.match(sql, /logo_url text/)
})

test("16. Estado de configuración correcto", () => {
  const incomplete = buildBillingConfigurationStatus({ settings: null })
  assert.equal(incomplete.incomplete, true)
  assert.ok(incomplete.missing.some((item) => item.code === "legal_name"))
  assert.ok(incomplete.missing.some((item) => item.code === "tax_id"))
  assert.ok(incomplete.missing.some((item) => item.code === "vat_condition"))
  assert.ok(incomplete.missing.some((item) => item.code === "tax_address"))
  assert.ok(incomplete.missing.some((item) => item.code === "point_of_sale"))

  const ready = buildBillingConfigurationStatus({
    settings: {
      legalName: "Bespoke Operations S.A.",
      taxId: VALID_CUIT,
      vatCondition: "responsable_inscripto",
      taxAddress: "Av. Siempre Viva 123",
      pointOfSale: {
        id: "pos-1",
        companyId: "co-1",
        number: 1,
        description: "Casa central",
        active: true,
        createdAt: "",
        updatedAt: "",
      },
      integrations: [
        {
          provider: "arca",
          status: "not_configured",
          environment: null,
          lastSyncAt: null,
        },
        {
          provider: "siro",
          status: "not_configured",
          environment: null,
          lastSyncAt: null,
        },
      ],
    },
  })
  assert.equal(ready.companyReady, true)
  assert.equal(ready.pointOfSaleReady, true)
  assert.equal(ready.incomplete, false)
  assert.equal(ready.labels.company, ISP_BILLING_COMPANY_READY_LABEL)
  assert.equal(ready.labels.pointOfSale, ISP_BILLING_POS_READY_LABEL)
  assert.equal(ready.labels.arca, ISP_BILLING_ARCA_PENDING_LABEL)
  assert.equal(ready.labels.siro, ISP_BILLING_SIRO_PENDING_LABEL)
  assert.match(statusApi, /buildBillingConfigurationStatus/)
})

test("numeración se bloquea si ya hubo emisión y no se emite todavía", () => {
  assert.equal(canEditDocumentSequence(0), true)
  assert.equal(canEditDocumentSequence(1), false)
  const issues = validateBillingCompanyDraft(
    completeDraft({
      sequences: emptyBillingDraft().sequences.map((item) =>
        item.documentType === "factura_b"
          ? { ...item, nextNumber: "99" }
          : item
      ),
    }),
    {
      existingSequences: [
        {
          id: "seq-1",
          companyId: "co-1",
          pointOfSaleId: "pos-1",
          documentType: "factura_b",
          nextNumber: 1,
          issuedCount: 4,
          createdAt: "",
          updatedAt: "",
        },
      ],
    }
  )
  assert.ok(
    issues.some((issue) => issue.message === ISP_BILLING_SEQUENCE_LOCKED_MESSAGE)
  )
  assert.equal(ISP_BILLING_DOCUMENT_TYPES.includes("factura_a"), true)
  assert.doesNotMatch(queries, /cae|CAE|emitInvoice|wsfe/)
  assert.doesNotMatch(sql, /INSERT INTO public\.isp_billing_issued/)
})

test("no se modifican clientes, abonados, tesorería ni migraciones anteriores", () => {
  assert.doesNotMatch(sql, /ALTER TABLE public\.customers/)
  assert.doesNotMatch(sql, /ALTER TABLE public\.isp_subscribers/)
  assert.doesNotMatch(sql, /ALTER TABLE public\.isp_services/)
  assert.doesNotMatch(sql, /ALTER TABLE public\.isp_connections/)
  assert.doesNotMatch(sql, /tesoreria_movements|treasury/)
  assert.match(sqlPrevious, /remove_isp_subscriber_membership/)
  assert.ok(APP_MODULE_KEYS.includes("facturacion"))
  assert.match(
    read("app/(dashboard)/configuracion/facturacion/page.tsx"),
    /IspBillingSettingsScreen/
  )
  assert.match(
    read("app/(dashboard)/facturacion/configuracion/page.tsx"),
    /redirect\("\/configuracion\/facturacion"\)/
  )
  assert.equal(ISP_BILLING_POS_REQUIRED_MESSAGE, "Falta punto de venta")
})
