import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  billingContentAreaHeightMm,
  billingContentBottomMm,
  billingInnerBottomMm,
  BILLING_DOCUMENT_LAYOUT,
} from "../lib/isp/billing-document-layout.ts"
import { planBillingDocumentPages } from "../lib/isp/billing-document-pagination.ts"
import {
  buildBillingDocumentTemplateModel,
  buildBillingDocumentPreviewModel,
  ISP_BILLING_TEMPLATE_PREVIEW_CUSTOMER,
  ISP_BILLING_TEMPLATE_PREVIEW_ISSUE_DATE,
} from "../lib/isp/billing-document-template.ts"
import { DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS } from "../lib/isp/billing-template-settings.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const sheet = read("components/isp/isp-billing-document-sheet.tsx")
const pdf = read("lib/isp/billing-document-pdf.ts")
const pagination = read("lib/isp/billing-document-pagination.ts")

function shortModel(observations = "Observación corta de prueba.") {
  return buildBillingDocumentTemplateModel({
    documentType: "presupuesto",
    formattedNumber: "0001-00000001",
    pointOfSaleNumber: 1,
    issueDate: ISP_BILLING_TEMPLATE_PREVIEW_ISSUE_DATE,
    dueDate: "2026-09-15",
    issuer: {
      legalName: "Bespoke Operations S.A.",
      taxId: "20-12345678-6",
      vatCondition: "responsable_inscripto",
      taxAddress: "Av. Siempre Viva 123",
      city: "Córdoba",
      province: "Córdoba",
      postalCode: "5000",
      phone: "351-555-0100",
      email: "facturacion@example.com",
      website: "https://example.com",
      logoUrl: null,
    },
    customer: { ...ISP_BILLING_TEMPLATE_PREVIEW_CUSTOMER },
    items: [
      {
        description: "Servicio Internet 300 Mbps",
        quantity: 1,
        unitPrice: 30000,
        lineTotal: 30000,
        taxAmount: 0,
        taxRate: 0,
      },
      {
        description: "Proporcional agosto",
        quantity: 1,
        unitPrice: 6774.19,
        lineTotal: 6774.19,
        taxAmount: 0,
        taxRate: 0,
      },
    ],
    subtotal: 36774.19,
    discountTotal: 0,
    taxTotal: 0,
    total: 36774.19,
    observations,
    templateSettings: DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS,
  })
}

function manyItemsModel(count = 28) {
  const items = Array.from({ length: count }, (_, index) => ({
    description: `Línea de servicio ${index + 1} con descripción extendida para ocupar espacio`,
    quantity: 1,
    unitPrice: 1500,
    lineTotal: 1500,
    taxAmount: 0,
    taxRate: 0,
  }))
  const subtotal = items.length * 1500
  return buildBillingDocumentTemplateModel({
    documentType: "factura_b",
    formattedNumber: "0001-00000042",
    pointOfSaleNumber: 1,
    issueDate: ISP_BILLING_TEMPLATE_PREVIEW_ISSUE_DATE,
    issuer: {
      legalName: "Bespoke Operations S.A.",
      taxId: "20-12345678-6",
      vatCondition: "responsable_inscripto",
      taxAddress: "Av. Siempre Viva 123",
      city: "Córdoba",
      province: "Córdoba",
      postalCode: "5000",
      phone: "",
      email: "",
      website: "",
      logoUrl: null,
    },
    customer: { ...ISP_BILLING_TEMPLATE_PREVIEW_CUSTOMER },
    items,
    subtotal,
    discountTotal: 0,
    taxTotal: 0,
    total: subtotal,
    observations: "Observaciones al final del comprobante.",
    templateSettings: DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS,
  })
}

test("área útil A4: content bottom alinea footer band con margen inferior", () => {
  const inner = billingInnerBottomMm()
  const bottom = billingContentBottomMm()
  assert.ok(
    Math.abs(inner - bottom - BILLING_DOCUMENT_LAYOUT.footer.heightMm) < 0.01
  )
  assert.equal(
    billingContentAreaHeightMm(),
    bottom - BILLING_DOCUMENT_LAYOUT.margin.topMm
  )
  assert.match(pdf, /innerBottom\(doc\) - L\.footer\.heightMm/)
  assert.match(pdf, /const top = contentBottom\(doc\)/)
})

test("Caso A: pocos conceptos y observación corta en una sola página", () => {
  const plan = planBillingDocumentPages(shortModel())
  assert.equal(plan.pages.length, 1)
  assert.equal(plan.pages[0].showTotals, true)
  assert.equal(plan.pages[0].showObservations, true)
  assert.equal(plan.pages[0].itemIndices.length, 2)
})

test("Caso B/C: muchas líneas paginan tabla; observaciones al final", () => {
  const plan = planBillingDocumentPages(manyItemsModel())
  assert.ok(plan.pages.length >= 2)
  const last = plan.pages[plan.pages.length - 1]
  assert.equal(last.showObservations, true)
  assert.equal(last.showTotals, true)
  const tablePages = plan.pages.filter((page) => page.itemIndices.length > 0)
  assert.ok(tablePages.length >= 2)
})

test("Caso D: totales permanecen juntos en la misma página", () => {
  const plan = planBillingDocumentPages(shortModel())
  const totalsPage = plan.pages.find((page) => page.showTotals)
  assert.ok(totalsPage)
  assert.equal(totalsPage.showTotals, true)
  assert.match(pdf, /totalsBlockHeight/)
  assert.match(pdf, /ensureSpace\(doc, y, totalsBlockHeight\)/)
})

test("preview usa proporción A4 real y paginación compartida", () => {
  assert.match(sheet, /aspectRatio: `\$\{L\.page\.widthMm\} \/ \${L\.page\.heightMm\}`/)
  assert.match(sheet, /boxSizing: "border-box"/)
  assert.match(sheet, /planBillingDocumentPages/)
  assert.match(sheet, /data-billing-document-page/)
  assert.doesNotMatch(sheet, /minHeight: "297mm"/)
  assert.doesNotMatch(sheet, /beforeFooterMm/)
  assert.match(pagination, /planBillingDocumentPages/)
})

test("preview settings model entra en una página", () => {
  const preview = buildBillingDocumentPreviewModel({
    draft: {
      legalName: "Bespoke Operations S.A.",
      taxId: "20-12345678-6",
      vatCondition: "responsable_inscripto",
      taxAddress: "Av. Siempre Viva 123",
      city: "Córdoba",
      province: "Córdoba",
      postalCode: "5000",
      phone: "351-555-0100",
      email: "facturacion@example.com",
      website: "https://example.com",
      logoUrl: "",
      pointOfSale: { number: 1 },
      templateSettings: DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS,
    },
    documentType: "presupuesto",
  })
  const plan = planBillingDocumentPages(preview)
  assert.equal(plan.pages.length, 1)
})
