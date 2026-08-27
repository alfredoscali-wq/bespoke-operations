import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  ISP_BILLING_DOCUMENT_NON_FISCAL_NOTICE,
  ISP_BILLING_FORBIDDEN_MESSAGE,
} from "../lib/isp/billing-constants.ts"
import {
  buildBillingDocumentPdf,
  buildBillingDocumentPdfFromModel,
} from "../lib/isp/billing-document-pdf.ts"
import {
  BILLING_DOCUMENT_TABLE_COLUMNS,
  buildBillingDocumentPreviewModel,
  buildBillingDocumentTemplateModelFromDocument,
  ISP_BILLING_DOCUMENT_IDENTIFICATION,
  ISP_BILLING_TEMPLATE_PREVIEW_CUSTOMER,
  ISP_BILLING_TEMPLATE_PREVIEW_ITEMS,
} from "../lib/isp/billing-document-template.ts"
import { BILLING_DOCUMENT_LAYOUT } from "../lib/isp/billing-document-layout.ts"
import {
  snapshotDiffersFromLiveCustomer,
} from "../lib/isp/billing-document-integrity.ts"
import {
  emptyBillingDraft,
  settingsToDraft,
  validateBillingCompanyDraft,
} from "../lib/isp/billing-integrity.ts"
import {
  canAccessIspBilling,
  canWriteIspBilling,
} from "../lib/isp/permissions.ts"
import {
  DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS,
  ISP_BILLING_FOOTER_LEGEND_MAX_LENGTH,
  ISP_BILLING_LOGO_URL_INVALID_MESSAGE,
  ISP_BILLING_TEMPLATE_FOOTER_HTML_MESSAGE,
  ISP_BILLING_TEMPLATE_INVALID_MESSAGE,
  ISP_BILLING_TEMPLATE_LOGO_POSITION_MESSAGE,
  ISP_BILLING_TEMPLATE_UNKNOWN_KEY_MESSAGE,
  isAllowedBillingLogoUrl,
  parseIspBillingTemplateSettings,
  sanitizeBillingFooterLegend,
  serializeIspBillingTemplateSettings,
  validateIspBillingTemplateSettingsInput,
} from "../lib/isp/billing-template-settings.ts"
import { createEmptyModuleVisibility } from "../lib/roles/app-modules.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const sql = read(
  "supabase/migrations/20261145000100_isp_1_7_billing_document_template.sql"
)
const settingsApi = read("app/api/isp/billing/settings/route.ts")
const pdfApi = read("app/api/isp/billing/documents/[id]/pdf/route.ts")
const screen = read("components/isp/isp-billing-settings-screen.tsx")
const preview = read("components/isp/isp-billing-document-preview.tsx")
const sheet = read("components/isp/isp-billing-document-sheet.tsx")
const detail = read("components/isp/isp-billing-document-detail-screen.tsx")
const pdfSource = read("lib/isp/billing-document-pdf.ts")
const templateSource = read("lib/isp/billing-document-template.ts")
const mapper = read("lib/isp/billing-mapper.ts")
const typesFile = read("lib/supabase/database.types.ts")

const VALID_CUIT = "20-12345678-6"

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
    phone: "351-555-0100",
    email: "facturacion@bespoke.test",
    logoUrl: "https://cdn.example.com/logo.png",
    ...overrides,
  }
}

function sampleDocument(overrides = {}) {
  return {
    id: "doc-1",
    companyId: "co-1",
    billingCompanySettingsId: "set-1",
    pointOfSaleId: "pos-1",
    documentType: "factura_b",
    status: "issued",
    authorizationStatus: "pending_integration",
    issueDate: "2026-08-29",
    dueDate: "2026-09-15",
    number: 1,
    formattedNumber: "0001-00000001",
    customerId: "cus-1",
    subscriberId: "sub-1",
    customerNameSnapshot: "Juan Pérez",
    customerDocumentTypeSnapshot: "dni",
    customerDocumentNumberSnapshot: "30111222",
    customerTaxIdSnapshot: "",
    customerVatConditionSnapshot: "consumidor_final",
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
    issuerPhoneSnapshot: "351-400-0000",
    issuerEmailSnapshot: "hola@bespoke.test",
    issuerWebsiteSnapshot: "",
    issuerLogoUrlSnapshot: "https://cdn.example.com/logo-snapshot.png",
    pointOfSaleNumber: 1,
    subtotal: 35200,
    discountTotal: 0,
    taxTotal: 0,
    total: 35200,
    observations: "Snapshot de observaciones",
    cae: null,
    caeExpiresAt: null,
    billingRunId: null,
    periodYear: null,
    periodMonth: null,
    createdAt: "2026-08-29T12:00:00.000Z",
    updatedAt: "2026-08-29T12:00:00.000Z",
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
    ],
    events: [],
    ...overrides,
  }
}

function pdfText(bytes) {
  return Buffer.from(bytes).toString("latin1")
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

test("1. plantilla usa datos de empresa", () => {
  const model = buildBillingDocumentPreviewModel({
    draft: completeDraft(),
    documentType: "factura_b",
  })
  assert.equal(model.issuer.legalName, "Bespoke Operations S.A.")
  assert.match(model.issuer.taxId, /20-12345678-6/)
  assert.match(model.issuer.addressLine ?? "", /Av\. Siempre Viva 123/)
  assert.match(sql, /template_settings jsonb/)
  assert.match(mapper, /template_settings/)
  assert.match(typesFile, /template_settings/)
})

test("2. logo configurable", () => {
  const shown = buildBillingDocumentPreviewModel({
    draft: completeDraft({
      templateSettings: {
        ...DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS,
        showLogo: true,
      },
    }),
    documentType: "factura_b",
  })
  const hidden = buildBillingDocumentPreviewModel({
    draft: completeDraft({
      templateSettings: {
        ...DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS,
        showLogo: false,
      },
    }),
    documentType: "factura_b",
  })
  assert.equal(shown.issuer.showLogo, true)
  assert.equal(shown.issuer.logoUrl, "https://cdn.example.com/logo.png")
  assert.equal(hidden.issuer.showLogo, false)
  assert.equal(hidden.issuer.logoUrl, null)
  assert.match(screen, /Mostrar logo/)
  assert.match(screen, /URL del logo/)
})

test("3. posición de logo", () => {
  for (const logoPosition of ["left", "center", "right"]) {
    const model = buildBillingDocumentPreviewModel({
      draft: completeDraft({
        templateSettings: {
          ...DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS,
          logoPosition,
        },
      }),
      documentType: "factura_b",
    })
    assert.equal(model.issuer.logoPosition, logoPosition)
  }
  assert.match(screen, /Posición del logo/)
  assert.match(sheet, /position === "center"/)
  assert.match(pdfSource, /logoPosition === "center"/)
})

test("4. mostrar/ocultar teléfono", () => {
  const shown = buildBillingDocumentPreviewModel({
    draft: completeDraft(),
    documentType: "factura_b",
  })
  const hidden = buildBillingDocumentPreviewModel({
    draft: completeDraft({
      templateSettings: {
        ...DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS,
        showPhone: false,
      },
    }),
    documentType: "factura_b",
  })
  assert.equal(shown.issuer.phone, "351-555-0100")
  assert.equal(hidden.issuer.phone, null)
})

test("5. mostrar/ocultar email", () => {
  const shown = buildBillingDocumentPreviewModel({
    draft: completeDraft(),
    documentType: "factura_b",
  })
  const hidden = buildBillingDocumentPreviewModel({
    draft: completeDraft({
      templateSettings: {
        ...DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS,
        showEmail: false,
      },
    }),
    documentType: "factura_b",
  })
  assert.equal(shown.issuer.email, "facturacion@bespoke.test")
  assert.equal(hidden.issuer.email, null)
})

test("6. mostrar/ocultar domicilio", () => {
  const shown = buildBillingDocumentPreviewModel({
    draft: completeDraft(),
    documentType: "factura_b",
  })
  const hidden = buildBillingDocumentPreviewModel({
    draft: completeDraft({
      templateSettings: {
        ...DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS,
        showAddress: false,
      },
    }),
    documentType: "factura_b",
  })
  assert.equal(shown.issuer.addressLine, "Av. Siempre Viva 123")
  assert.ok(shown.issuer.localityLine)
  assert.equal(hidden.issuer.addressLine, null)
  assert.equal(hidden.issuer.localityLine, null)
})

test("7. mostrar/ocultar observaciones", () => {
  const shown = buildBillingDocumentPreviewModel({
    draft: completeDraft(),
    documentType: "factura_b",
  })
  const hidden = buildBillingDocumentPreviewModel({
    draft: completeDraft({
      templateSettings: {
        ...DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS,
        showObservations: false,
      },
    }),
    documentType: "factura_b",
  })
  assert.ok(shown.observations)
  assert.equal(hidden.observations, null)
  const custom = buildBillingDocumentPreviewModel({
    draft: completeDraft({
      templateSettings: {
        ...DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS,
        observationsText: "Muchas gracias por su confianza.",
      },
    }),
    documentType: "factura_b",
  })
  assert.equal(custom.observations, "Muchas gracias por su confianza.")
})

test("8. leyenda configurable", () => {
  const model = buildBillingDocumentPreviewModel({
    draft: completeDraft({
      templateSettings: {
        ...DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS,
        footerLegend: "Gracias por confiar en Bespoke.",
      },
    }),
    documentType: "factura_b",
  })
  assert.equal(model.footerLegend, "Gracias por confiar en Bespoke.")
  assert.match(screen, /Leyenda inferior personalizada/)
  assert.match(screen, /htmlFor="billing-observations-text"/)
  assert.match(screen, /Mostrar email/)
  assert.equal(ISP_BILLING_FOOTER_LEGEND_MAX_LENGTH, 240)
})

test("9. preview no crea comprobante", () => {
  const model = buildBillingDocumentPreviewModel({
    draft: completeDraft(),
    documentType: "factura_b",
  })
  assert.equal(model.customer.name, ISP_BILLING_TEMPLATE_PREVIEW_CUSTOMER.name)
  assert.equal(
    model.items[0]?.description,
    ISP_BILLING_TEMPLATE_PREVIEW_ITEMS[0].description
  )
  assert.doesNotMatch(templateSource, /createIspBillingDocument/)
  assert.doesNotMatch(templateSource, /from\("isp_billing_documents"\)/)
  assert.doesNotMatch(screen, /\/api\/isp\/billing\/documents/)
  assert.match(screen, /No\s+crea un comprobante/)
})

test("10. Factura A", () => {
  const model = buildBillingDocumentPreviewModel({
    draft: completeDraft(),
    documentType: "factura_a",
  })
  assert.equal(model.identification.letter, "A")
  assert.equal(model.identification.kindLabel, "FACTURA")
  assert.equal(model.nonFiscalNotice, null)
  assert.equal(ISP_BILLING_DOCUMENT_IDENTIFICATION.factura_a.letter, "A")
})

test("11. Factura B", () => {
  const model = buildBillingDocumentPreviewModel({
    draft: completeDraft(),
    documentType: "factura_b",
  })
  assert.equal(model.identification.letter, "B")
  assert.equal(model.identification.kindLabel, "FACTURA")
  const text = pdfText(buildBillingDocumentPdfFromModel(model))
  assert.match(text, /FACTURA/)
  assert.match(text, /B/)
})

test("12. Factura C", () => {
  const model = buildBillingDocumentPreviewModel({
    draft: completeDraft(),
    documentType: "factura_c",
  })
  assert.equal(model.identification.letter, "C")
  assert.equal(model.identification.kindLabel, "FACTURA")
})

test("13. Presupuesto", () => {
  const model = buildBillingDocumentPreviewModel({
    draft: completeDraft(),
    documentType: "presupuesto",
  })
  assert.equal(model.identification.letter, null)
  assert.equal(model.identification.kindLabel, "PRESUPUESTO")
  assert.equal(model.nonFiscalNotice, ISP_BILLING_DOCUMENT_NON_FISCAL_NOTICE)
})

test("14. Comprobante X", () => {
  const model = buildBillingDocumentPreviewModel({
    draft: completeDraft(),
    documentType: "comprobante_x",
  })
  assert.equal(model.identification.letter, "X")
  assert.equal(model.identification.kindLabel, "COMPROBANTE X")
  assert.match(sheet, /letter !== "X"/)
  assert.equal(model.nonFiscalNotice, ISP_BILLING_DOCUMENT_NON_FISCAL_NOTICE)
})

test("15. Nota de Crédito", () => {
  const model = buildBillingDocumentPreviewModel({
    draft: completeDraft(),
    documentType: "nota_credito",
  })
  assert.equal(model.identification.kindLabel, "NOTA DE CRÉDITO")
  assert.equal(model.nonFiscalNotice, null)
  assert.match(screen, /nota_credito/)
})

test("16. Nota de Débito", () => {
  const model = buildBillingDocumentPreviewModel({
    draft: completeDraft(),
    documentType: "nota_debito",
  })
  assert.equal(model.identification.kindLabel, "NOTA DE DÉBITO")
  assert.equal(model.identification.letter, null)
})

test("17. documento no fiscal muestra leyenda", () => {
  const hiddenExtras = buildBillingDocumentPreviewModel({
    draft: completeDraft({
      templateSettings: {
        ...DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS,
        showObservations: false,
        footerLegend: "",
      },
    }),
    documentType: "presupuesto",
  })
  assert.equal(
    hiddenExtras.nonFiscalNotice,
    ISP_BILLING_DOCUMENT_NON_FISCAL_NOTICE
  )
  assert.match(sheet, /nonFiscalNotice/)
  assert.match(preview, /ISP_BILLING_DOCUMENT_NON_FISCAL_NOTICE/)
  assert.doesNotMatch(screen, /ocultar leyenda no fiscal/)
})

test("18. CAE NULL no inventa CAE ni QR", () => {
  const model = buildBillingDocumentTemplateModelFromDocument(sampleDocument())
  assert.equal(model.fiscal.showCae, false)
  assert.equal(model.fiscal.cae, null)
  assert.equal(model.fiscal.caeDisplay, "—")
  const text = pdfText(buildBillingDocumentPdf(sampleDocument()))
  assert.doesNotMatch(text, /CAE \d{8,}/)
  assert.match(sheet, /data-billing-qr-reserved/)
  assert.match(sheet, /BILLING_DOCUMENT_QR_ZONE_LABEL/)
  assert.doesNotMatch(pdfSource, /qrcode|QR ficticio/i)
  assert.doesNotMatch(pdfSource, /addImage\([^\)]*qr/i)
})

test("19. snapshot histórico se respeta", () => {
  const document = sampleDocument()
  const model = buildBillingDocumentTemplateModelFromDocument(document, {
    ...DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS,
    showPhone: true,
    showEmail: true,
    showAddress: true,
  })
  assert.equal(model.customer.name, document.customerNameSnapshot)
  assert.equal(model.customer.addressLine, document.customerTaxAddressSnapshot)
  assert.equal(model.issuer.legalName, document.issuerLegalNameSnapshot)
  assert.equal(model.issuer.logoUrl, document.issuerLogoUrlSnapshot)
  assert.equal(model.issuer.phone, document.issuerPhoneSnapshot)
  assert.match(templateSource, /issuerLegalNameSnapshot/)
  assert.match(templateSource, /customerNameSnapshot/)
  assert.match(detail, /Snapshot fiscal al momento del comprobante/)
})

test("20. cambio posterior del cliente no modifica comprobante histórico", () => {
  const document = sampleDocument()
  assert.equal(
    snapshotDiffersFromLiveCustomer(document, {
      name: "Juan Pérez Actualizado",
      dni: "30111222",
      email: "nuevo@example.com",
    }),
    true
  )
  const model = buildBillingDocumentTemplateModelFromDocument(document)
  assert.equal(model.customer.name, "Juan Pérez")
  assert.doesNotMatch(model.customer.name, /Actualizado/)
  assert.doesNotMatch(pdfSource, /from\("customers"\)/)
})

test("21. cambio posterior de configuración fiscal no modifica snapshot", () => {
  const document = sampleDocument()
  const liveDraft = completeDraft({
    legalName: "Otra Razón Social S.A.",
    taxAddress: "Domicilio nuevo 999",
    phone: "000-000",
    logoUrl: "https://cdn.example.com/logo-nuevo.png",
  })
  const model = buildBillingDocumentTemplateModelFromDocument(document, {
    ...DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS,
    showPhone: true,
  })
  assert.notEqual(model.issuer.legalName, liveDraft.legalName)
  assert.equal(model.issuer.legalName, "Bespoke Operations S.A.")
  assert.equal(model.issuer.addressLine, "Av. Siempre Viva 123")
  assert.equal(model.issuer.logoUrl, "https://cdn.example.com/logo-snapshot.png")
  assert.match(pdfApi, /issuerLogoUrlSnapshot/)
  assert.match(pdfApi, /templateSettings/)
})

test("22. PDF utiliza la misma estructura", () => {
  const document = sampleDocument({ documentType: "presupuesto" })
  const model = buildBillingDocumentTemplateModelFromDocument(document)
  const text = pdfText(buildBillingDocumentPdf(document))
  assert.match(text, /PRESUPUESTO/)
  assert.match(text, /Juan Pérez/)
  assert.match(text, /Internet FTTH 100 Mbps/)
  assert.match(text, /CANT\./)
  assert.match(text, /DESCRIPCIÓN|DESCRIPCI/)
  assert.match(text, /PRECIO UNIT\./)
  assert.match(text, /CLIENTE/)
  assert.match(text, /CONCEPTOS/)
  assert.match(text, /TOTAL/)
  assert.match(text, /DOCUMENTO NO VÁLIDO COMO FACTURA/)
  for (const column of BILLING_DOCUMENT_TABLE_COLUMNS) {
    assert.equal(typeof column.label, "string")
  }
  assert.match(pdfSource, /buildBillingDocumentTemplateModelFromDocument/)
  assert.match(pdfSource, /addPage/)
  const longDocument = sampleDocument({
    items: Array.from({ length: 40 }, (_, index) => ({
      ...document.items[0],
      id: `item-${index}`,
      description: `Concepto de prueba ${index + 1}`,
      sortOrder: index,
    })),
  })
  const longBytes = buildBillingDocumentPdf(longDocument)
  assert.ok(longBytes.byteLength > 800)
  assert.match(pdfText(longBytes), /Concepto de prueba 40/)
})

test("23. permisos", () => {
  assert.equal(canAccessIspBilling(adminUser), true)
  assert.equal(canWriteIspBilling(adminUser), true)
  assert.equal(canAccessIspBilling(operatorUser), false)
  assert.equal(canWriteIspBilling(operatorUser), false)
  assert.match(settingsApi, /requireIspBillingWriteContext/)
  assert.match(settingsApi, /requireIspBillingReadContext/)
  assert.match(screen, /disabled=\{!canWrite/)
  assert.equal(ISP_BILLING_FORBIDDEN_MESSAGE.length > 0, true)
})

test("24. sanitización de leyenda", () => {
  assert.equal(sanitizeBillingFooterLegend("  Hola mundo  "), "Hola mundo")
  assert.equal(sanitizeBillingFooterLegend("<b>Hola</b>"), "Hola")
  const htmlIssues = validateIspBillingTemplateSettingsInput({
    footerLegend: "<script>alert(1)</script>",
  })
  assert.ok(
    htmlIssues.some(
      (issue) => issue.message === ISP_BILLING_TEMPLATE_FOOTER_HTML_MESSAGE
    )
  )
  const long = "x".repeat(ISP_BILLING_FOOTER_LEGEND_MAX_LENGTH + 1)
  const lengthIssues = validateIspBillingTemplateSettingsInput({
    footerLegend: long,
  })
  assert.ok(lengthIssues.length > 0)
  assert.equal(isAllowedBillingLogoUrl("javascript:alert(1)"), false)
  assert.equal(isAllowedBillingLogoUrl("https://cdn.example.com/logo.png"), true)
})

test("25. configuración inválida rechazada", () => {
  const unknown = validateIspBillingTemplateSettingsInput({
    showLogo: true,
    extra: true,
  })
  assert.ok(
    unknown.some(
      (issue) => issue.message === ISP_BILLING_TEMPLATE_UNKNOWN_KEY_MESSAGE
    )
  )
  const position = validateIspBillingTemplateSettingsInput({
    logoPosition: "top",
  })
  assert.ok(
    position.some(
      (issue) => issue.message === ISP_BILLING_TEMPLATE_LOGO_POSITION_MESSAGE
    )
  )
  const booleanIssue = validateIspBillingTemplateSettingsInput({
    showPhone: "yes",
  })
  assert.ok(
    booleanIssue.some(
      (issue) => issue.message === ISP_BILLING_TEMPLATE_INVALID_MESSAGE
    )
  )
  const draftIssues = validateBillingCompanyDraft(
    completeDraft({
      templateSettings: {
        ...DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS,
        logoPosition: "top",
      },
    })
  )
  assert.ok(draftIssues.length > 0)
  const logoIssues = validateBillingCompanyDraft(
    completeDraft({ logoUrl: "javascript:alert(1)" })
  )
  assert.ok(
    logoIssues.some(
      (issue) => issue.message === ISP_BILLING_LOGO_URL_INVALID_MESSAGE
    )
  )
  const serialized = serializeIspBillingTemplateSettings({
    ...DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS,
    footerLegend: "Pie",
  })
  assert.deepEqual(Object.keys(serialized).sort(), [
    "footer_legend",
    "logo_position",
    "observations_text",
    "show_address",
    "show_email",
    "show_logo",
    "show_observations",
    "show_phone",
  ])
  const parsed = parseIspBillingTemplateSettings({
    show_logo: false,
    logo_position: "right",
    show_phone: false,
    show_email: true,
    show_address: true,
    show_observations: false,
    footer_legend: "Pie",
  })
  assert.equal(parsed.showLogo, false)
  assert.equal(parsed.logoPosition, "right")
  const draft = settingsToDraft(null)
  assert.equal(draft.templateSettings.showLogo, true)
  assert.match(sql, /isp_billing_company_settings/)
  assert.doesNotMatch(sql, /wsfe|solicitarCae|siro\.com/)
  assert.doesNotMatch(sql, /ALTER TABLE public\.isp_billing_documents/)
  assert.match(sheet, /minHeight: "297mm"/)
  assert.match(sheet, /max-w-\[min\(100%,210mm\)\]/)
})

test("26. preview y PDF usan el mismo layout", () => {
  assert.match(sheet, /BILLING_DOCUMENT_LAYOUT/)
  assert.match(pdfSource, /BILLING_DOCUMENT_LAYOUT/)
  assert.doesNotMatch(pdfSource, /\.circle\(/)
  assert.doesNotMatch(pdfSource, /withMark/)
  assert.doesNotMatch(pdfSource, /\* 0\.55/)
  assert.doesNotMatch(pdfSource, /\* 0\.45/)
  assert.deepEqual([...BILLING_DOCUMENT_LAYOUT.table.columns], [5, 34, 8, 14, 13, 13, 13])
  assert.equal(BILLING_DOCUMENT_LAYOUT.margin.xMm, 20)
  assert.equal(BILLING_DOCUMENT_LAYOUT.margin.topMm, 20)
  assert.equal(BILLING_DOCUMENT_LAYOUT.page.heightMm, 297)
  assert.equal(BILLING_DOCUMENT_LAYOUT.logo.heightPx, 64)
  assert.equal(BILLING_DOCUMENT_LAYOUT.header.letterSizePx, 52)
  assert.equal(BILLING_DOCUMENT_LAYOUT.customer.widthPx, 448)
  assert.equal(BILLING_DOCUMENT_LAYOUT.footer.qrSizePx, 72)
  assert.match(sheet, /L\.margin\.topMm/)
  assert.match(sheet, /L\.header\.afterHeaderMm/)
  assert.match(sheet, /L\.customer\.widthPx/)
  assert.match(pdfSource, /L\.customer\.widthMm/)
  assert.match(pdfSource, /L\.header\.afterHeaderMm/)
  assert.match(pdfSource, /logoPosition === "center"/)
  assert.equal(BILLING_DOCUMENT_LAYOUT.header.metaLabelPercent, 46)
  assert.equal(BILLING_DOCUMENT_LAYOUT.header.metaValuePercent, 54)
  assert.match(sheet, /metaLabelPercent/)
  assert.match(pdfSource, /pdfSafeText\(label\)/)
})
