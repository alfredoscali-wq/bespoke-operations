import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  ISP_BILLING_DOCUMENT_ARCA_PENDING,
  ISP_BILLING_DOCUMENT_CUSTOMER_REQUIRED,
  ISP_BILLING_DOCUMENT_ISSUED_LOCKED,
  ISP_BILLING_DOCUMENT_ISSUED_PENDING_LABEL,
  ISP_BILLING_DOCUMENT_ITEMS_REQUIRED,
  ISP_BILLING_DOCUMENT_NON_FISCAL_NOTICE,
  ISP_BILLING_DOCUMENT_TYPE_INVALID,
  ISP_BILLING_DOCUMENT_TYPES,
  ISP_BILLING_DOCUMENTS_EMPTY_DESCRIPTION,
  ISP_BILLING_DOCUMENTS_EMPTY_TITLE,
  ISP_BILLING_DOCUMENTS_SUBTITLE,
  ISP_BILLING_DOCUMENTS_TITLE,
  ISP_BILLING_FORBIDDEN_MESSAGE,
} from "../lib/isp/billing-constants.ts"
import {
  billingDocumentRequiresCae,
  calculateBillingTotals,
  canCancelBillingDocument,
  canEditBillingDocument,
  canIssueBillingDocument,
  displayBillingDocumentStatus,
  formatBillingDocumentNumber,
  snapshotCustomerFromRecord,
  snapshotDiffersFromLiveCustomer,
  suggestedServiceConcept,
  validateBillingDocumentDraft,
} from "../lib/isp/billing-document-integrity.ts"
import { buildBillingDocumentPdf } from "../lib/isp/billing-document-pdf.ts"
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

const sql = read("supabase/migrations/20261140000100_isp_1_6b_comprobantes.sql")
const sqlPrevious = read(
  "supabase/migrations/20261139000100_isp_1_6a_billing_company_settings.sql"
)
const sqlIsp15 = read(
  "supabase/migrations/20261138000100_isp_1_5_abonado_eliminacion_admin.sql"
)
const queries = read("lib/isp/billing-document-queries.ts")
const integrity = read("lib/isp/billing-document-integrity.ts")
const pdfSource = read("lib/isp/billing-document-pdf.ts")
const listApi = read("app/api/isp/billing/documents/route.ts")
const itemApi = read("app/api/isp/billing/documents/[id]/route.ts")
const issueApi = read("app/api/isp/billing/documents/[id]/issue/route.ts")
const cancelApi = read("app/api/isp/billing/documents/[id]/cancel/route.ts")
const pdfApi = read("app/api/isp/billing/documents/[id]/pdf/route.ts")
const listScreen = read("components/isp/isp-billing-documents-list-screen.tsx")
const formScreen = read("components/isp/isp-billing-document-form-screen.tsx")
const detailScreen = read("components/isp/isp-billing-document-detail-screen.tsx")
const preview = read("components/isp/isp-billing-document-preview.tsx")
const templateSource = read("lib/isp/billing-document-template.ts")
const typesFile = read("lib/supabase/database.types.ts")

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
const billingOnly = {
  ...createEmptyModuleVisibility(),
  facturacion: true,
}

function sampleDocument(overrides = {}) {
  return {
    id: "doc-1",
    companyId: "co-1",
    billingCompanySettingsId: "set-1",
    pointOfSaleId: "pos-1",
    documentType: "presupuesto",
    status: "draft",
    authorizationStatus: "not_required",
    issueDate: "2026-09-01",
    dueDate: "2026-09-15",
    number: null,
    formattedNumber: null,
    customerId: "cus-1",
    subscriberId: "sub-1",
    customerNameSnapshot: "Juan Pérez",
    customerDocumentTypeSnapshot: "dni",
    customerDocumentNumberSnapshot: "30111222",
    customerTaxIdSnapshot: "",
    customerVatConditionSnapshot: "",
    customerTaxAddressSnapshot: "Calle Falsa 123",
    customerCitySnapshot: "Córdoba",
    customerProvinceSnapshot: "",
    customerPostalCodeSnapshot: "",
    customerEmailSnapshot: "juan@example.com",
    issuerLegalNameSnapshot: "Bespoke Operations S.A.",
    issuerTaxIdSnapshot: "20-12345678-6",
    issuerVatConditionSnapshot: "responsable_inscripto",
    issuerTaxAddressSnapshot: "Av. Siempre Viva 123",
    issuerCitySnapshot: "Córdoba",
    issuerProvinceSnapshot: "Córdoba",
    issuerPostalCodeSnapshot: "5000",
    issuerPhoneSnapshot: "",
    issuerEmailSnapshot: "",
    issuerWebsiteSnapshot: "",
    issuerLogoUrlSnapshot: null,
    pointOfSaleNumber: 1,
    subtotal: 35200,
    discountTotal: 0,
    taxTotal: 0,
    total: 35200,
    observations: "Prueba ISP 1.6B",
    cae: null,
    caeExpiresAt: null,
    billingRunId: null,
    periodYear: null,
    periodMonth: null,
    createdAt: "2026-09-01T12:00:00.000Z",
    updatedAt: "2026-09-01T12:00:00.000Z",
    items: [
      {
        id: "item-1",
        companyId: "co-1",
        documentId: "doc-1",
        serviceId: null,
        description: "Internet FTTH 100 Mbps",
        quantity: 1,
        unitPrice: 30000,
        discount: 0,
        taxableBase: 30000,
        taxAmount: 0,
        taxType: "",
        taxRate: 0,
        lineTotal: 30000,
        sortOrder: 0,
      },
      {
        id: "item-2",
        companyId: "co-1",
        documentId: "doc-1",
        serviceId: null,
        description: "Proporcional agosto",
        quantity: 1,
        unitPrice: 5200,
        discount: 0,
        taxableBase: 5200,
        taxAmount: 0,
        taxType: "",
        taxRate: 0,
        lineTotal: 5200,
        sortOrder: 1,
      },
    ],
    events: [{ id: "ev-1", eventType: "created", payload: {}, createdAt: "2026-09-01T12:00:00.000Z" }],
    ...overrides,
  }
}

function assignSequentialNumbers(nextNumber, count) {
  const assigned = []
  let next = nextNumber
  for (let index = 0; index < count; index += 1) {
    assigned.push(next)
    next += 1
  }
  return { assigned, next }
}

test("1. Crear borrador no consume número", () => {
  assert.match(queries, /status: "draft"/)
  assert.match(queries, /number: null/)
  assert.match(queries, /formatted_number: null/)
  assert.match(sql, /Drafts keep NULL to avoid consuming sequence numbers/)
  assert.match(queries, /export async function createIspBillingDocument/)
})

test("2. Cliente obligatorio", () => {
  const issues = validateBillingDocumentDraft({
    documentType: "presupuesto",
    customerId: "",
    items: [{ description: "Abono", quantity: 1, unitPrice: 100 }],
  })
  assert.ok(
    issues.some((issue) => issue.message === ISP_BILLING_DOCUMENT_CUSTOMER_REQUIRED)
  )
})

test("3. Empresa emisora obtenida de configuración", () => {
  assert.match(queries, /getIspBillingSettings/)
  assert.match(queries, /billing_company_settings_id: settings.id/)
  assert.match(formScreen, /Emite:/)
  assert.match(formScreen, /No se puede cambiar aquí/)
  assert.doesNotMatch(formScreen, /empresa_facturadora_id/)
})

test("4. Punto de venta correcto", () => {
  assert.match(queries, /point_of_sale_id: settings.pointOfSale.id/)
  assert.match(queries, /point_of_sale_number: settings.pointOfSale.number/)
  assert.match(formScreen, /Punto de venta:/)
  assert.match(listScreen, /Punto de venta/)
  assert.match(listApi, /pointOfSaleId/)
})

test("5. Tipo de comprobante válido", () => {
  assert.deepEqual(ISP_BILLING_DOCUMENT_TYPES, [
    "factura_a",
    "factura_b",
    "factura_c",
    "comprobante_x",
    "presupuesto",
    "nota_credito",
    "nota_debito",
  ])
  const issues = validateBillingDocumentDraft({
    documentType: "factura_z",
    customerId: "cus-1",
    items: [{ description: "Abono", quantity: 1, unitPrice: 100 }],
  })
  assert.ok(issues.some((issue) => issue.message === ISP_BILLING_DOCUMENT_TYPE_INVALID))
  assert.match(sql, /'factura_a'/)
  assert.match(sql, /'presupuesto'/)
})

test("6. Conceptos", () => {
  const empty = validateBillingDocumentDraft({
    documentType: "factura_b",
    customerId: "cus-1",
    items: [],
  })
  assert.ok(empty.some((issue) => issue.message === ISP_BILLING_DOCUMENT_ITEMS_REQUIRED))
  assert.match(sql, /isp_billing_document_items/)
  assert.match(formScreen, /suggestedServiceConcept/)
  assert.equal(suggestedServiceConcept({ planName: "Fibra 100", catalogCode: "FTTH-100" }), "Abono FTTH-100")
})

test("7. Cálculo de subtotal", () => {
  const totals = calculateBillingTotals([
    { quantity: 1, unitPrice: 30000 },
    { quantity: 1, unitPrice: 5200 },
  ])
  assert.equal(totals.subtotal, 35200)
  assert.equal(totals.discountTotal, 0)
})

test("8. Cálculo de total desde conceptos, sin impuestos inventados", () => {
  const totals = calculateBillingTotals([
    { quantity: 2, unitPrice: 1000, discount: 100, taxAmount: 210 },
  ])
  assert.equal(totals.subtotal, 2000)
  assert.equal(totals.discountTotal, 100)
  assert.equal(totals.taxTotal, 0)
  assert.equal(totals.total, 1900)
  assert.equal(totals.lines[0]?.taxAmount, 0)
  assert.match(formScreen, /No se puede escribir un total libre/)
  assert.doesNotMatch(formScreen, /name=\"total\"/)
})

test("9. Snapshot fiscal del cliente", () => {
  const snapshot = snapshotCustomerFromRecord({
    name: "Juan Pérez",
    dni: "30111222",
    email: "juan@example.com",
    address: "Calle Falsa 123",
    locality: "Córdoba",
  })
  assert.equal(snapshot.name, "Juan Pérez")
  assert.equal(snapshot.documentType, "dni")
  assert.equal(snapshot.documentNumber, "30111222")
  assert.match(queries, /customer_name_snapshot: snapshot.name/)
  assert.match(sql, /customer_name_snapshot text NOT NULL/)
})

test("10. Modificar cliente después no cambia el snapshot", () => {
  const snapshot = {
    customerNameSnapshot: "Juan Pérez",
    customerDocumentNumberSnapshot: "30111222",
    customerEmailSnapshot: "juan@example.com",
  }
  assert.equal(
    snapshotDiffersFromLiveCustomer(snapshot, {
      name: "Juan Pérez Actualizado",
      dni: "30111222",
      email: "juan@example.com",
    }),
    true
  )
  assert.equal(
    snapshotDiffersFromLiveCustomer(snapshot, {
      name: "Juan Pérez",
      dni: "30111222",
      email: "juan@example.com",
    }),
    false
  )
  assert.match(detailScreen, /Snapshot fiscal al momento del comprobante/)
  assert.match(pdfSource, /customerNameSnapshot/)
  assert.match(templateSource, /customerNameSnapshot/)
  assert.doesNotMatch(pdfSource, /from\("customers"\)/)
})

test("11. Emitir comprobante", () => {
  assert.equal(canIssueBillingDocument("draft"), true)
  assert.equal(canIssueBillingDocument("issued"), false)
  assert.match(issueApi, /requireIspBillingWriteContext/)
  assert.match(issueApi, /issueIspBillingDocument/)
  assert.match(queries, /rpc\("issue_isp_billing_document"/)
  assert.match(sql, /status = 'issued'/)
})

test("12. Asignación segura de número", () => {
  assert.equal(formatBillingDocumentNumber(1, 1), "0001-00000001")
  assert.match(sql, /FOR UPDATE/)
  assert.match(sql, /next_number = v_assigned \+ 1/)
  assert.match(sql, /Never uses SELECT MAX\(number\)\+1/)
  assert.doesNotMatch(sql, /v_assigned := \(SELECT MAX/)
  assert.doesNotMatch(queries, /SELECT MAX/)
  assert.doesNotMatch(formScreen, /id="document-number"/)
  assert.doesNotMatch(formScreen, /Número del comprobante/)
})

test("13. No duplicar numeración", () => {
  const first = assignSequentialNumbers(1, 2)
  assert.deepEqual(first.assigned, [1, 2])
  assert.equal(first.next, 3)
  assert.equal(new Set(first.assigned).size, first.assigned.length)
  assert.match(
    sql,
    /CONSTRAINT isp_billing_documents_number_unique\s+UNIQUE \(company_id, point_of_sale_id, document_type, number\)/
  )
  assert.match(sql, /ON CONFLICT \(company_id, point_of_sale_id, document_type\) DO NOTHING/)
})

test("14. Borrador no consume número", () => {
  assert.match(sql, /number integer CHECK \(number IS NULL OR number >= 1\)/)
  assert.doesNotMatch(queries, /from\("isp_billing_document_sequences"\)/)
  assert.match(queries, /rpc\("issue_isp_billing_document"/)
})

test("15. Emitido no permite edición", () => {
  assert.equal(canEditBillingDocument("draft"), true)
  assert.equal(canEditBillingDocument("issued"), false)
  assert.equal(canEditBillingDocument("cancelled"), false)
  assert.match(queries, /canEditBillingDocument/)
  assert.match(queries, /ISP_BILLING_DOCUMENT_ISSUED_LOCKED/)
  assert.equal(ISP_BILLING_DOCUMENT_ISSUED_LOCKED, "Un comprobante emitido no se puede modificar.")
  assert.match(itemApi, /updateIspBillingDocument/)
})

test("16. Anulación lógica", () => {
  assert.equal(canCancelBillingDocument("issued"), true)
  assert.equal(canCancelBillingDocument("cancelled"), false)
  assert.match(sql, /status = 'cancelled'/)
  assert.match(sql, /'cancelled'/)
  assert.doesNotMatch(sql, /DELETE FROM public\.isp_billing_documents/)
  assert.match(cancelApi, /cancelIspBillingDocument/)
  assert.match(detailScreen, /ISP_BILLING_DOCUMENT_CANCEL_CONFIRM/)
  assert.match(read("lib/isp/billing-constants.ts"), /¿Querés anular este comprobante\?/)
})

test("17. X/Presupuesto no requiere CAE", () => {
  assert.equal(billingDocumentRequiresCae("presupuesto"), false)
  assert.equal(billingDocumentRequiresCae("comprobante_x"), false)
  assert.equal(billingDocumentRequiresCae("factura_b"), true)
  const issuedX = displayBillingDocumentStatus({
    status: "issued",
    documentType: "presupuesto",
    authorizationStatus: "not_required",
  })
  assert.equal(issuedX.label, "Emitido")
  assert.match(sql, /WHEN v_is_fiscal THEN 'pending_integration'/)
  assert.match(preview, /ISP_BILLING_DOCUMENT_NON_FISCAL_NOTICE/)
  assert.equal(ISP_BILLING_DOCUMENT_NON_FISCAL_NOTICE, "DOCUMENTO NO VÁLIDO COMO FACTURA")
})

test("18. Factura fiscal queda preparada para autorización", () => {
  const issuedB = displayBillingDocumentStatus({
    status: "issued",
    documentType: "factura_b",
    authorizationStatus: "pending_integration",
  })
  assert.equal(issuedB.label, ISP_BILLING_DOCUMENT_ISSUED_PENDING_LABEL)
  assert.equal(ISP_BILLING_DOCUMENT_ARCA_PENDING, "Pendiente de integración ARCA")
  assert.match(detailScreen, /Autorización fiscal/)
  assert.match(sql, /pending_integration/)
  assert.match(sql, /CONSTRAINT isp_billing_documents_cae_not_required/)
  assert.match(sql, /CHECK \(cae IS NULL\)/)
})

test("19. Multi-tenant", () => {
  assert.equal(ignoreClientCompanyId("co-session", "co-attacker"), "co-session")
  assert.match(queries, /ignoreClientCompanyId/)
  assert.match(sql, /enforce_isp_billing_document_company_match/)
  assert.match(listApi, /auth.companyId/)
  assert.doesNotMatch(listApi, /body\.companyId/)
})

test("20. RLS", () => {
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /company_id = public.auth_user_company_id\(\)/)
  assert.match(sql, /auth_user_has_allowed_module\('facturacion'\)/)
  assert.match(sql, /isp_billing_documents_select_policy/)
  assert.match(sql, /isp_billing_document_items_select_policy/)
  assert.match(sql, /isp_billing_document_events_select_policy/)
})

test("21. Usuario sin permiso no puede crear/modificar", () => {
  assert.equal(canAccessIspBilling(adminUser), true)
  assert.equal(canWriteIspBilling(adminUser), true)
  assert.equal(canAccessIspBilling(operatorUser), false)
  assert.equal(canWriteIspBilling(operatorUser), false)
  assert.equal(canAccessPathWithModules("/facturacion/comprobantes", createEmptyModuleVisibility()), false)
  assert.equal(canAccessPathWithModules("/facturacion/comprobantes", billingOnly), true)
  assert.match(listApi, /requireIspBillingWriteContext/)
  assert.match(issueApi, /requireIspBillingWriteContext/)
  assert.equal(ISP_BILLING_FORBIDDEN_MESSAGE.length > 0, true)
})

test("22. PDF y vista previa usan datos reales, sin CAE", () => {
  const document = sampleDocument({
    status: "issued",
    number: 1,
    formattedNumber: "0001-00000001",
  })
  const bytes = buildBillingDocumentPdf(document)
  assert.ok(bytes.byteLength > 200)
  const text = Buffer.from(bytes).toString("latin1")
  assert.match(text, /Juan Pérez/)
  assert.match(text, /Bespoke Operations S\.A\./)
  assert.match(text, /Internet FTTH 100 Mbps/)
  assert.match(text, /DOCUMENTO NO VÁLIDO COMO FACTURA/)
  assert.doesNotMatch(text, /CAE 7/)
  assert.doesNotMatch(text, /\bCAE\b/)
  const withCae = buildBillingDocumentPdf(
    sampleDocument({
      documentType: "factura_b",
      cae: "12345678912345",
      caeExpiresAt: "2026-09-15",
    })
  )
  assert.match(Buffer.from(withCae).toString("latin1"), /12345678912345/)
  assert.match(templateSource, /issuerLegalNameSnapshot/)
  assert.match(templateSource, /customerNameSnapshot/)
  assert.match(preview, /buildBillingDocumentTemplateModelFromDocument/)
  assert.match(pdfApi, /buildBillingDocumentPdf/)
  assert.match(pdfApi, /loadBillingLogoDataUrl/)
})

test("23. Regresión ISP 1.6A", () => {
  assert.match(sqlPrevious, /isp_billing_company_settings/)
  assert.match(sqlPrevious, /isp_billing_point_of_sales/)
  assert.match(sqlPrevious, /isp_billing_document_sequences/)
  assert.doesNotMatch(sql, /ALTER TABLE public\.isp_billing_company_settings/)
  assert.doesNotMatch(sql, /ALTER TABLE public\.isp_billing_point_of_sales/)
  assert.match(
    read("app/(dashboard)/configuracion/facturacion/page.tsx"),
    /IspBillingSettingsScreen/
  )
  assert.match(typesFile, /isp_billing_documents:/)
  assert.match(typesFile, /issue_isp_billing_document:/)
})

test("24. Regresiones ISP anteriores y alcance del sprint", () => {
  assert.match(sqlIsp15, /remove_isp_subscriber_membership/)
  assert.doesNotMatch(sql, /ALTER TABLE public\.customers/)
  assert.doesNotMatch(sql, /ALTER TABLE public\.isp_subscribers/)
  assert.doesNotMatch(sql, /ALTER TABLE public\.isp_services/)
  assert.doesNotMatch(sql, /wsfe|wsaa|solicitarCae|certificado/)
  assert.doesNotMatch(queries, /wsfe|siro\.com|prorrateo|facturaci[oó]n mensual/)
  assert.doesNotMatch(sql, /cron|pg_cron|prorrateo/)
  assert.doesNotMatch(integrity, /taxAmount = input\.taxAmount/)
  assert.equal(ISP_BILLING_DOCUMENTS_TITLE, "Comprobantes")
  assert.equal(
    ISP_BILLING_DOCUMENTS_SUBTITLE,
    "Gestioná facturas, presupuestos y demás documentos emitidos."
  )
  assert.equal(ISP_BILLING_DOCUMENTS_EMPTY_TITLE, "Todavía no hay comprobantes")
  assert.equal(
    ISP_BILLING_DOCUMENTS_EMPTY_DESCRIPTION,
    "Cuando generes una factura, presupuesto u otro documento aparecerá aquí."
  )
  assert.match(listScreen, /Nuevo comprobante/)
  assert.equal(getPageMetaForProfile("/facturacion/comprobantes", "administrador").title, "Comprobantes")
  assert.match(
    read("app/(dashboard)/facturacion/page.tsx"),
    /redirect\("\/facturacion\/comprobantes"\)/
  )
})
