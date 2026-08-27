import {
  ISP_BILLING_DOCUMENT_NON_FISCAL_NOTICE,
  ISP_BILLING_LINE_TAX_LABELS,
  isIspBillingLineTaxCode,
  type IspBillingDocumentType,
} from "@/lib/isp/billing-constants"
import {
  formatBillingDocumentNumber,
  formatBillingMoney,
  formatIspBillingIvaRateLabel,
  vatConditionLabel,
} from "@/lib/isp/billing-document-integrity"
import type { IspBillingDocument } from "@/lib/isp/billing-document-types"
import { formatCuit, isFiscalBillingDocument } from "@/lib/isp/billing-integrity"
import {
  DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS,
  parseIspBillingTemplateSettings,
  sanitizeBillingFooterLegend,
  sanitizeBillingObservationsText,
  type IspBillingLogoPosition,
  type IspBillingTemplateSettings,
} from "@/lib/isp/billing-template-settings"
import { parseDateOnlyForDisplay } from "@/lib/dates/date-only"
import type { IspBillingCompanySettingsDraft } from "@/lib/isp/billing-types"

export const BILLING_DOCUMENT_TABLE_COLUMNS = [
  { key: "index", label: "#", align: "right" },
  { key: "description", label: "DESCRIPCIÓN", align: "left" },
  { key: "quantity", label: "CANT.", align: "right" },
  { key: "unitPrice", label: "PRECIO UNIT.", align: "right" },
  { key: "discount", label: "DESCUENTO", align: "right" },
  { key: "tax", label: "IMPUESTO", align: "right" },
  { key: "amount", label: "IMPORTE", align: "right" },
] as const

export const BILLING_DOCUMENT_QR_RESERVED_LABEL =
  "QR (cuando esté disponible)"
export const BILLING_DOCUMENT_QR_ZONE_LABEL = "ZONA QR"
export const BILLING_DOCUMENT_CAE_PLACEHOLDER = "—"

export const BILLING_DOCUMENT_VISUAL = {
  accent: [37, 99, 235] as [number, number, number],
  accentSoft: [237, 242, 252] as [number, number, number],
  ink: [28, 32, 40] as [number, number, number],
  muted: [108, 114, 126] as [number, number, number],
  line: [226, 230, 236] as [number, number, number],
  discount: [185, 28, 28] as [number, number, number],
}

export const ISP_BILLING_DOCUMENT_IDENTIFICATION: Record<
  IspBillingDocumentType,
  { letter: "A" | "B" | "C" | "X" | null; kindLabel: string }
> = {
  factura_a: { letter: "A", kindLabel: "FACTURA" },
  factura_b: { letter: "B", kindLabel: "FACTURA" },
  factura_c: { letter: "C", kindLabel: "FACTURA" },
  comprobante_x: { letter: "X", kindLabel: "COMPROBANTE X" },
  presupuesto: { letter: null, kindLabel: "PRESUPUESTO" },
  nota_credito: { letter: null, kindLabel: "NOTA DE CRÉDITO" },
  nota_debito: { letter: null, kindLabel: "NOTA DE DÉBITO" },
}

export const ISP_BILLING_TEMPLATE_PREVIEW_ISSUE_DATE = "2026-08-29"
export const ISP_BILLING_TEMPLATE_PREVIEW_OBSERVATIONS =
  "Documento de ejemplo. No se emite ni se guarda un comprobante real."

export const ISP_BILLING_TEMPLATE_PREVIEW_CUSTOMER = {
  name: "Ana Gómez",
  documentType: "dni",
  documentNumber: "28445901",
  taxId: "",
  vatCondition: "consumidor_final",
  taxAddress: "Av. Colón 1200",
  city: "Córdoba",
  province: "Córdoba",
  postalCode: "5000",
} as const

export const ISP_BILLING_TEMPLATE_PREVIEW_ITEMS = [
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
] as const

export type BillingDocumentTemplateLine = {
  indexLabel: string
  quantityLabel: string
  description: string
  unitPriceLabel: string
  discountLabel: string
  taxLabel: string
  amountLabel: string
  hasDiscount: boolean
}

export type BillingDocumentTemplateTotal = {
  label: string
  amountLabel: string
  emphasize: boolean
  variant: "default" | "discount" | "tax" | "total"
}

export type BillingDocumentTemplateModel = {
  documentType: IspBillingDocumentType
  identification: {
    letter: "A" | "B" | "C" | "X" | null
    kindLabel: string
    numberLabel: string
    pointOfSaleLabel: string
    documentNumberLabel: string
    issueDateLabel: string
    dueDateLabel: string | null
    vatConditionLabel: string | null
  }
  issuer: {
    legalName: string
    taxId: string
    vatConditionLabel: string
    addressLine: string | null
    localityLine: string | null
    phone: string | null
    email: string | null
    website: string | null
    logoUrl: string | null
    showLogo: boolean
    logoPosition: IspBillingLogoPosition
  }
  customer: {
    name: string
    documentLabel: string
    vatConditionLabel: string | null
    addressLine: string | null
    localityLine: string | null
  }
  items: BillingDocumentTemplateLine[]
  totals: BillingDocumentTemplateTotal[]
  observations: string | null
  footerLegend: string | null
  nonFiscalNotice: string | null
  fiscal: {
    cae: string | null
    caeExpiresAtLabel: string | null
    showCae: boolean
    caeDisplay: string
    caeExpiresDisplay: string
  }
}

type TemplateIssuerInput = {
  legalName: string
  taxId: string
  vatCondition: string
  taxAddress: string
  city: string
  province: string
  postalCode: string
  phone: string
  email: string
  website: string
  logoUrl: string | null
}

type TemplateCustomerInput = {
  name: string
  documentType: string
  documentNumber: string
  taxId: string
  vatCondition: string
  taxAddress: string
  city: string
  province: string
  postalCode: string
}

type TemplateItemInput = {
  quantity: number
  description: string
  unitPrice: number
  discount?: number
  lineTotal: number
  taxAmount: number
  taxRate: number
  taxType?: string | null
}

function joinParts(parts: Array<string | null | undefined>): string | null {
  const joined = parts.map((part) => part?.trim() ?? "").filter(Boolean).join(" · ")
  return joined || null
}

function lineTaxLabel(item: TemplateItemInput): string {
  if (item.taxRate > 0) return formatIspBillingIvaRateLabel(item.taxRate)
  const taxType = String(item.taxType ?? "").trim()
  if (isIspBillingLineTaxCode(taxType)) {
    if (taxType === "iva_0") return "IVA 0%"
    return ISP_BILLING_LINE_TAX_LABELS[taxType]
  }
  return "—"
}

function splitDocumentNumber(
  formattedNumber: string | null,
  pointOfSaleNumber: number
): { pointOfSaleLabel: string; documentNumberLabel: string } {
  const pointOfSaleLabel = pointOfSaleNumber
    ? String(pointOfSaleNumber).padStart(4, "0")
    : "—"
  const formatted = formattedNumber?.trim() ?? ""
  const match = formatted.match(/^(\d{4})-(\d{8})$/)
  if (match) {
    return { pointOfSaleLabel: match[1] ?? pointOfSaleLabel, documentNumberLabel: match[2] ?? "—" }
  }
  if (!formatted || formatted.endsWith("-00000000")) {
    return { pointOfSaleLabel, documentNumberLabel: "—" }
  }
  return { pointOfSaleLabel, documentNumberLabel: formatted }
}

function formatBillingDocumentDate(value: string): string {
  const parsed = parseDateOnlyForDisplay(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsed)
}

function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return "0"
  if (Number.isInteger(value)) return String(value)
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function customerDocumentLabel(input: TemplateCustomerInput): string {
  const kind = input.documentType.trim().toUpperCase() || "DNI"
  const number =
    input.documentNumber.trim() ||
    formatCuit(input.taxId) ||
    input.taxId.trim() ||
    "—"
  return `${kind} ${number}`.trim()
}

function buildTaxRows(input: {
  items: readonly TemplateItemInput[]
  taxTotal: number
}): BillingDocumentTemplateTotal[] {
  if (!(input.taxTotal > 0)) return []

  const grouped = new Map<number, number>()
  for (const item of input.items) {
    if (!(item.taxAmount > 0)) continue
    const rate = Number.isFinite(item.taxRate) ? item.taxRate : 0
    grouped.set(rate, (grouped.get(rate) ?? 0) + item.taxAmount)
  }

  if (grouped.size > 0) {
    return [...grouped.entries()].map(([rate, amount]) => ({
      label: rate > 0 ? formatIspBillingIvaRateLabel(rate) : "Impuestos",
      amountLabel: formatBillingMoney(amount),
      emphasize: false,
      variant: "tax" as const,
    }))
  }

  return [
    {
      label: "Impuestos",
      amountLabel: formatBillingMoney(input.taxTotal),
      emphasize: false,
      variant: "tax",
    },
  ]
}

function resolveTemplateSettings(
  settings?: IspBillingTemplateSettings | null
): IspBillingTemplateSettings {
  return parseIspBillingTemplateSettings(
    settings ?? DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS
  )
}

export function buildBillingDocumentTemplateModel(input: {
  documentType: IspBillingDocumentType
  formattedNumber: string | null
  pointOfSaleNumber: number
  issueDate: string
  dueDate?: string | null
  issuer: TemplateIssuerInput
  customer: TemplateCustomerInput
  items: readonly TemplateItemInput[]
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
  observations: string
  cae?: string | null
  caeExpiresAt?: string | null
  templateSettings?: IspBillingTemplateSettings | null
}): BillingDocumentTemplateModel {
  const template = resolveTemplateSettings(input.templateSettings)
  const identification = ISP_BILLING_DOCUMENT_IDENTIFICATION[input.documentType]
  const numberLabel =
    input.formattedNumber?.trim() ||
    (input.pointOfSaleNumber
      ? `${String(input.pointOfSaleNumber).padStart(4, "0")}-00000000`
      : "Sin número")
  const splitNumber = splitDocumentNumber(
    input.formattedNumber,
    input.pointOfSaleNumber
  )
  const footerLegend = sanitizeBillingFooterLegend(template.footerLegend)
  const defaultObservations = sanitizeBillingObservationsText(
    template.observationsText
  )
  const observations = input.observations.trim() || defaultObservations
  const cae = input.cae?.trim() || null
  const issuerVatLabel = vatConditionLabel(input.issuer.vatCondition)
  const issuerVatConditionLabel =
    issuerVatLabel && issuerVatLabel !== "—" ? issuerVatLabel : null
  const caeExpiresAtLabel =
    cae && input.caeExpiresAt
      ? formatBillingDocumentDate(input.caeExpiresAt)
      : null

  return {
    documentType: input.documentType,
    identification: {
      letter: identification.letter,
      kindLabel: identification.kindLabel,
      numberLabel,
      pointOfSaleLabel: splitNumber.pointOfSaleLabel,
      documentNumberLabel: splitNumber.documentNumberLabel,
      issueDateLabel: formatBillingDocumentDate(input.issueDate),
      dueDateLabel: input.dueDate
        ? formatBillingDocumentDate(input.dueDate)
        : null,
      vatConditionLabel: issuerVatConditionLabel,
    },
    issuer: {
      legalName: input.issuer.legalName.trim() || "Empresa facturadora",
      taxId: formatCuit(input.issuer.taxId) || input.issuer.taxId.trim() || "—",
      vatConditionLabel: vatConditionLabel(input.issuer.vatCondition),
      addressLine: template.showAddress
        ? input.issuer.taxAddress.trim() || null
        : null,
      localityLine: template.showAddress
        ? joinParts([
            input.issuer.city,
            input.issuer.province,
            input.issuer.postalCode,
          ])
        : null,
      phone: template.showPhone ? input.issuer.phone.trim() || null : null,
      email: template.showEmail ? input.issuer.email.trim() || null : null,
      website: input.issuer.website.trim() || null,
      logoUrl: template.showLogo ? input.issuer.logoUrl?.trim() || null : null,
      showLogo: template.showLogo && Boolean(input.issuer.logoUrl?.trim()),
      logoPosition: template.logoPosition,
    },
    customer: {
      name: input.customer.name.trim() || "Cliente",
      documentLabel: customerDocumentLabel(input.customer),
      vatConditionLabel: input.customer.vatCondition
        ? vatConditionLabel(input.customer.vatCondition)
        : null,
      addressLine: input.customer.taxAddress.trim() || null,
      localityLine: joinParts([
        input.customer.city,
        input.customer.province,
        input.customer.postalCode,
      ]),
    },
    items: input.items.map((item, index) => {
      const discount = item.discount ?? 0
      return {
        indexLabel: String(index + 1),
        quantityLabel: formatQuantity(item.quantity),
        description: item.description.trim() || "—",
        unitPriceLabel: formatBillingMoney(item.unitPrice),
        discountLabel: discount > 0 ? formatBillingMoney(discount) : "—",
        taxLabel: lineTaxLabel(item),
        amountLabel: formatBillingMoney(item.lineTotal),
        hasDiscount: discount > 0,
      }
    }),
    totals: [
      {
        label: "Subtotal",
        amountLabel: formatBillingMoney(input.subtotal),
        emphasize: false,
        variant: "default",
      },
      ...(input.discountTotal > 0
        ? [
            {
              label: "Descuentos",
              amountLabel: `− ${formatBillingMoney(input.discountTotal)}`,
              emphasize: false,
              variant: "discount" as const,
            },
          ]
        : []),
      ...buildTaxRows({ items: input.items, taxTotal: input.taxTotal }),
      {
        label: "TOTAL",
        amountLabel: formatBillingMoney(input.total),
        emphasize: true,
        variant: "total",
      },
    ],
    observations:
      template.showObservations && observations ? observations : null,
    footerLegend: footerLegend || null,
    nonFiscalNotice: isFiscalBillingDocument(input.documentType)
      ? null
      : ISP_BILLING_DOCUMENT_NON_FISCAL_NOTICE,
    fiscal: {
      cae,
      caeExpiresAtLabel,
      showCae: Boolean(cae),
      caeDisplay: cae || BILLING_DOCUMENT_CAE_PLACEHOLDER,
      caeExpiresDisplay: caeExpiresAtLabel || BILLING_DOCUMENT_CAE_PLACEHOLDER,
    },
  }
}

export function buildBillingDocumentTemplateModelFromDocument(
  document: IspBillingDocument,
  templateSettings?: IspBillingTemplateSettings | null
): BillingDocumentTemplateModel {
  return buildBillingDocumentTemplateModel({
    documentType: document.documentType,
    formattedNumber: document.formattedNumber,
    pointOfSaleNumber: document.pointOfSaleNumber,
    issueDate: document.issueDate,
    dueDate: document.dueDate,
    issuer: {
      legalName: document.issuerLegalNameSnapshot,
      taxId: document.issuerTaxIdSnapshot,
      vatCondition: document.issuerVatConditionSnapshot,
      taxAddress: document.issuerTaxAddressSnapshot,
      city: document.issuerCitySnapshot,
      province: document.issuerProvinceSnapshot,
      postalCode: document.issuerPostalCodeSnapshot,
      phone: document.issuerPhoneSnapshot,
      email: document.issuerEmailSnapshot,
      website: document.issuerWebsiteSnapshot,
      logoUrl: document.issuerLogoUrlSnapshot,
    },
    customer: {
      name: document.customerNameSnapshot,
      documentType: document.customerDocumentTypeSnapshot,
      documentNumber: document.customerDocumentNumberSnapshot,
      taxId: document.customerTaxIdSnapshot,
      vatCondition: document.customerVatConditionSnapshot,
      taxAddress: document.customerTaxAddressSnapshot,
      city: document.customerCitySnapshot,
      province: document.customerProvinceSnapshot,
      postalCode: document.customerPostalCodeSnapshot,
    },
    items: document.items.map((item) => ({
      quantity: item.quantity,
      description: item.description,
      unitPrice: item.unitPrice,
      discount: item.discount,
      lineTotal: item.lineTotal,
      taxAmount: item.taxAmount,
      taxRate: item.taxRate,
      taxType: item.taxType,
    })),
    subtotal: document.subtotal,
    discountTotal: document.discountTotal,
    taxTotal: document.taxTotal,
    total: document.total,
    observations: document.observations,
    cae: document.cae,
    caeExpiresAt: document.caeExpiresAt,
    templateSettings,
  })
}

export function buildBillingDocumentPreviewModel(input: {
  draft: Pick<
    IspBillingCompanySettingsDraft,
    | "legalName"
    | "taxId"
    | "vatCondition"
    | "taxAddress"
    | "city"
    | "province"
    | "postalCode"
    | "phone"
    | "email"
    | "website"
    | "logoUrl"
    | "pointOfSale"
    | "templateSettings"
  >
  documentType: IspBillingDocumentType
}): BillingDocumentTemplateModel {
  const subtotal = ISP_BILLING_TEMPLATE_PREVIEW_ITEMS.reduce(
    (sum, item) => sum + item.lineTotal,
    0
  )
  const pointOfSaleNumber = Number(input.draft.pointOfSale.number) || 1

  return buildBillingDocumentTemplateModel({
    documentType: input.documentType,
    formattedNumber: formatBillingDocumentNumber(pointOfSaleNumber, 1),
    pointOfSaleNumber,
    issueDate: ISP_BILLING_TEMPLATE_PREVIEW_ISSUE_DATE,
    dueDate: "2026-09-15",
    issuer: {
      legalName: input.draft.legalName,
      taxId: input.draft.taxId,
      vatCondition: input.draft.vatCondition || "",
      taxAddress: input.draft.taxAddress,
      city: input.draft.city,
      province: input.draft.province,
      postalCode: input.draft.postalCode,
      phone: input.draft.phone,
      email: input.draft.email,
      website: input.draft.website,
      logoUrl: input.draft.logoUrl.trim() || null,
    },
    customer: { ...ISP_BILLING_TEMPLATE_PREVIEW_CUSTOMER },
    items: ISP_BILLING_TEMPLATE_PREVIEW_ITEMS.map((item) => ({ ...item })),
    subtotal,
    discountTotal: 0,
    taxTotal: 0,
    total: subtotal,
    observations:
      input.draft.templateSettings.observationsText.trim() ||
      ISP_BILLING_TEMPLATE_PREVIEW_OBSERVATIONS,
    cae: null,
    caeExpiresAt: null,
    templateSettings: input.draft.templateSettings,
  })
}
