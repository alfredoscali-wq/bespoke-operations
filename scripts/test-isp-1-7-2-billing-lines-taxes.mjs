import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  ISP_BILLING_DEFAULT_LINE_TAX_CODE,
  ISP_BILLING_DOCUMENT_ITEM_DISCOUNT_EXCEEDS,
  ISP_BILLING_DOCUMENT_ITEM_DISCOUNT_INVALID,
  ISP_BILLING_DOCUMENT_ITEM_DISCOUNT_NEGATIVE,
  ISP_BILLING_DOCUMENT_ITEM_QUANTITY_INVALID,
  ISP_BILLING_DOCUMENT_ITEM_QUANTITY_POSITIVE,
  ISP_BILLING_DOCUMENT_ITEM_TAX_INVALID,
  ISP_BILLING_DOCUMENT_ITEM_UNIT_PRICE_INVALID,
  ISP_BILLING_DOCUMENT_ITEM_UNIT_PRICE_NEGATIVE,
  ISP_BILLING_LINE_TAX_CODES,
  ISP_BILLING_LINE_TAX_LABELS,
} from "../lib/isp/billing-constants.ts"
import {
  calculateBillingLine,
  calculateBillingTotals,
  emptyDocumentItemDraft,
  formatIspBillingIvaRateLabel,
  isValidBillingNumberInput,
  roundBillingMoney,
  validateBillingDocumentDraft,
} from "../lib/isp/billing-document-integrity.ts"
import { buildBillingDocumentTemplateModel } from "../lib/isp/billing-document-template.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const integrity = read("lib/isp/billing-document-integrity.ts")
const queries = read("lib/isp/billing-document-queries.ts")
const formScreen = read("components/isp/isp-billing-document-form-screen.tsx")
const sheet = read("components/isp/isp-billing-document-sheet.tsx")
const pdf = read("lib/isp/billing-document-pdf.ts")

function draft(items) {
  return {
    documentType: "factura_b",
    customerId: "cus-1",
    items: items.map((item) => ({
      description: item.description ?? "Abono Internet",
      quantity: item.quantity ?? 1,
      unitPrice: item.unitPrice ?? 0,
      discount: item.discount ?? 0,
      taxType: item.taxType,
      taxRate: item.taxRate,
    })),
  }
}

function issueMessages(items) {
  return validateBillingDocumentDraft(draft(items)).map((issue) => issue.message)
}

function templateTotals(input) {
  return buildBillingDocumentTemplateModel({
    documentType: "factura_b",
    formattedNumber: "0001-00000001",
    pointOfSaleNumber: 1,
    issueDate: "2026-08-26",
    issuer: {
      legalName: "Bespoke",
      taxId: "30712345678",
      vatCondition: "responsable_inscripto",
      taxAddress: "Calle 1",
      city: "Córdoba",
      province: "Córdoba",
      postalCode: "5000",
      phone: "",
      email: "",
      website: "",
      logoUrl: null,
    },
    customer: {
      name: "Juan Pérez",
      documentType: "dni",
      documentNumber: "30111222",
      taxId: "",
      vatCondition: "",
      taxAddress: "",
      city: "",
      province: "",
      postalCode: "",
    },
    observations: "",
    ...input,
  }).totals
}

test("línea: importe = cantidad × precio unitario − descuento y no es editable", () => {
  const line = calculateBillingLine({
    quantity: 2,
    unitPrice: 1000,
    discount: 100,
  })
  assert.equal(line.gross, 2000)
  assert.equal(line.discount, 100)
  assert.equal(line.taxableBase, 1900)
  assert.equal(line.lineTotal, 1900)
  assert.equal(line.taxAmount, 0)
  assert.match(formScreen, />Importe</)
  assert.match(formScreen, /readOnly/)
  assert.match(formScreen, /cantidad × precio unitario − descuento/)
  assert.doesNotMatch(formScreen, /name="total"/)
  assert.doesNotMatch(formScreen, /name="importe"/)
})

test("ayuda breve de cada campo de concepto", () => {
  assert.match(formScreen, /Descripción/)
  assert.match(formScreen, /Cantidad/)
  assert.match(formScreen, /Precio unitario/)
  assert.match(formScreen, /Descuento/)
  assert.match(formScreen, /Impuesto/)
  assert.match(formScreen, /Importe/)
  assert.match(formScreen, /Texto del concepto que verá el cliente/)
  assert.match(formScreen, /Unidades del concepto/)
  assert.match(formScreen, /Precio de cada unidad/)
  assert.match(formScreen, /Monto a restar de esta línea/)
  assert.match(formScreen, /Alícuota de esta línea/)
})

test("resumen: Subtotal, Descuentos, Impuestos y TOTAL calculado", () => {
  const totals = calculateBillingTotals([
    { quantity: 1, unitPrice: 30000, discount: 2000, taxType: "iva_21" },
    { quantity: 1, unitPrice: 5000, taxType: "iva_0" },
  ])
  assert.equal(totals.subtotal, 35000)
  assert.equal(totals.discountTotal, 2000)
  assert.equal(totals.taxTotal, 5880)
  assert.equal(totals.total, 38880)
  assert.match(formScreen, /<dt>Subtotal<\/dt>/)
  assert.match(formScreen, /<dt>Descuentos<\/dt>/)
  assert.match(formScreen, /<dt>Impuestos<\/dt>/)
  assert.match(formScreen, /<dt>TOTAL<\/dt>/)
  assert.doesNotMatch(integrity, /total:\s*input\.total/)
})

test("múltiples conceptos y descuentos", () => {
  const totals = calculateBillingTotals([
    { quantity: 2, unitPrice: 1000, discount: 100, taxType: "iva_21" },
    { quantity: 1, unitPrice: 5000, discount: 0, taxType: "iva_105" },
  ])
  assert.equal(totals.subtotal, 7000)
  assert.equal(totals.discountTotal, 100)
  assert.equal(totals.lines[0]?.taxableBase, 1900)
  assert.equal(totals.lines[0]?.taxAmount, 399)
  assert.equal(totals.lines[1]?.taxAmount, 525)
  assert.equal(totals.taxTotal, 924)
  assert.equal(totals.total, 7824)
})

test("IVA 21%, 10,5%, 27% y 0% se calculan; exento y no gravado no inventan impuesto", () => {
  const iva21 = calculateBillingLine({
    quantity: 1,
    unitPrice: 10000,
    taxType: "iva_21",
  })
  const iva105 = calculateBillingLine({
    quantity: 1,
    unitPrice: 10000,
    taxType: "iva_105",
  })
  const iva27 = calculateBillingLine({
    quantity: 1,
    unitPrice: 10000,
    taxType: "iva_27",
  })
  const iva0 = calculateBillingLine({
    quantity: 1,
    unitPrice: 10000,
    taxType: "iva_0",
  })
  const exento = calculateBillingLine({
    quantity: 1,
    unitPrice: 10000,
    taxType: "exento",
  })
  const noGravado = calculateBillingLine({
    quantity: 1,
    unitPrice: 10000,
    taxType: "no_gravado",
  })

  assert.equal(iva21.taxRate, 21)
  assert.equal(iva21.taxAmount, 2100)
  assert.equal(iva105.taxRate, 10.5)
  assert.equal(iva105.taxAmount, 1050)
  assert.equal(iva27.taxRate, 27)
  assert.equal(iva27.taxAmount, 2700)
  assert.equal(iva0.taxAmount, 0)
  assert.equal(exento.taxAmount, 0)
  assert.equal(noGravado.taxAmount, 0)

  const mixed = calculateBillingTotals([
    { quantity: 1, unitPrice: 10000, taxType: "iva_21" },
    { quantity: 1, unitPrice: 10000, taxType: "iva_105" },
    { quantity: 1, unitPrice: 10000, taxType: "iva_27" },
    { quantity: 1, unitPrice: 10000, taxType: "iva_0" },
    { quantity: 1, unitPrice: 10000, taxType: "exento" },
    { quantity: 1, unitPrice: 10000, taxType: "no_gravado" },
  ])
  assert.equal(mixed.subtotal, 60000)
  assert.equal(mixed.taxTotal, 5850)
  assert.equal(mixed.total, 65850)

  assert.deepEqual([...ISP_BILLING_LINE_TAX_CODES], [
    "iva_21",
    "iva_105",
    "iva_27",
    "iva_0",
    "exento",
    "no_gravado",
  ])
  assert.equal(ISP_BILLING_LINE_TAX_LABELS.iva_21, "21%")
  assert.equal(ISP_BILLING_LINE_TAX_LABELS.iva_105, "10,5%")
  assert.equal(ISP_BILLING_LINE_TAX_LABELS.iva_27, "27%")
  assert.equal(ISP_BILLING_LINE_TAX_LABELS.iva_0, "0%")
  assert.equal(ISP_BILLING_LINE_TAX_LABELS.exento, "Exento")
  assert.equal(ISP_BILLING_LINE_TAX_LABELS.no_gravado, "No gravado")
  assert.match(formScreen, /ISP_BILLING_LINE_TAX_CODES/)
  assert.match(formScreen, /ISP_BILLING_LINE_TAX_LABELS/)
})

test("no inventa impuestos si solo llega taxAmount o una alícuota desconocida", () => {
  const invented = calculateBillingTotals([
    { quantity: 2, unitPrice: 1000, discount: 100, taxAmount: 210 },
  ])
  assert.equal(invented.taxTotal, 0)
  assert.equal(invented.lines[0]?.taxAmount, 0)
  assert.equal(invented.total, 1900)

  const unknownRate = calculateBillingLine({
    quantity: 1,
    unitPrice: 1000,
    taxRate: 15,
  })
  assert.equal(unknownRate.taxAmount, 0)
  assert.equal(unknownRate.taxType, ISP_BILLING_DEFAULT_LINE_TAX_CODE)
  assert.doesNotMatch(integrity, /taxAmount = input.taxAmount/)
})

test("validaciones numéricas, cantidad, precio, descuento y redondeo a 2 decimales", () => {
  assert.equal(isValidBillingNumberInput("10,5"), true)
  assert.equal(isValidBillingNumberInput("abc"), false)
  assert.equal(isValidBillingNumberInput(""), false)
  assert.equal(isValidBillingNumberInput("", { emptyMeansZero: true }), true)

  assert.ok(
    issueMessages([{ quantity: "abc", unitPrice: 100 }]).includes(
      ISP_BILLING_DOCUMENT_ITEM_QUANTITY_INVALID
    )
  )
  assert.ok(
    issueMessages([{ quantity: 0, unitPrice: 100 }]).includes(
      ISP_BILLING_DOCUMENT_ITEM_QUANTITY_POSITIVE
    )
  )
  assert.ok(
    issueMessages([{ quantity: 1, unitPrice: "xyz" }]).includes(
      ISP_BILLING_DOCUMENT_ITEM_UNIT_PRICE_INVALID
    )
  )
  assert.ok(
    issueMessages([{ quantity: 1, unitPrice: -10 }]).includes(
      ISP_BILLING_DOCUMENT_ITEM_UNIT_PRICE_NEGATIVE
    )
  )
  assert.ok(
    issueMessages([{ quantity: 1, unitPrice: 100, discount: "no" }]).includes(
      ISP_BILLING_DOCUMENT_ITEM_DISCOUNT_INVALID
    )
  )
  assert.ok(
    issueMessages([{ quantity: 1, unitPrice: 100, discount: -1 }]).includes(
      ISP_BILLING_DOCUMENT_ITEM_DISCOUNT_NEGATIVE
    )
  )
  assert.ok(
    issueMessages([{ quantity: 1, unitPrice: 100, discount: 100.01 }]).includes(
      ISP_BILLING_DOCUMENT_ITEM_DISCOUNT_EXCEEDS
    )
  )
  assert.equal(
    issueMessages([{ quantity: 1, unitPrice: 100, discount: 100 }]).length,
    0
  )
  assert.ok(
    issueMessages([{ quantity: 1, unitPrice: 100, taxType: "iva_99" }]).includes(
      ISP_BILLING_DOCUMENT_ITEM_TAX_INVALID
    )
  )

  const rounded = calculateBillingLine({
    quantity: 1,
    unitPrice: 10.333,
    taxType: "iva_21",
  })
  assert.equal(rounded.unitPrice, 10.33)
  assert.equal(rounded.taxAmount, 2.17)
  assert.equal(roundBillingMoney(10.333 * 0.21), 2.17)

  assert.equal(
    calculateBillingLine({
      quantity: "2,5",
      unitPrice: "1000,4",
    }).gross,
    2501
  )
})

test("persiste alícuota elegida y el PDF refleja los importes del resumen", () => {
  assert.equal(emptyDocumentItemDraft().taxType, ISP_BILLING_DEFAULT_LINE_TAX_CODE)
  assert.match(queries, /tax_type: line\.taxType/)
  assert.match(queries, /tax_rate: line\.taxRate/)
  assert.doesNotMatch(queries, /tax_type: ""/)
  assert.match(pdf, /buildBillingDocumentTemplateModelFromDocument/)

  const rows = templateTotals({
    items: [
      {
        quantity: 1,
        description: "Abono",
        unitPrice: 10000,
        lineTotal: 10000,
        taxAmount: 1050,
        taxRate: 10.5,
      },
    ],
    subtotal: 10000,
    discountTotal: 0,
    taxTotal: 1050,
    total: 11050,
  })
  assert.equal(formatIspBillingIvaRateLabel(10.5), "IVA 10,5%")
  assert.equal(formatIspBillingIvaRateLabel(21), "IVA 21%")
  assert.ok(rows.some((row) => row.label === "IVA 10,5%"))
  assert.ok(rows.some((row) => row.label === "TOTAL"))
  assert.doesNotMatch(sheet, /iva_21|FieldHelp|Precio unitario/)
})
