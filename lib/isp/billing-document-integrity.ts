import {
  ISP_BILLING_DEFAULT_LINE_TAX_CODE,
  ISP_BILLING_DOCUMENT_ISSUED_PENDING_LABEL,
  ISP_BILLING_DOCUMENT_ITEMS_REQUIRED,
  ISP_BILLING_DOCUMENT_ITEM_DESCRIPTION_REQUIRED,
  ISP_BILLING_DOCUMENT_ITEM_DISCOUNT_EXCEEDS,
  ISP_BILLING_DOCUMENT_ITEM_DISCOUNT_INVALID,
  ISP_BILLING_DOCUMENT_ITEM_DISCOUNT_NEGATIVE,
  ISP_BILLING_DOCUMENT_ITEM_QUANTITY_INVALID,
  ISP_BILLING_DOCUMENT_ITEM_QUANTITY_POSITIVE,
  ISP_BILLING_DOCUMENT_ITEM_TAX_INVALID,
  ISP_BILLING_DOCUMENT_ITEM_UNIT_PRICE_INVALID,
  ISP_BILLING_DOCUMENT_ITEM_UNIT_PRICE_NEGATIVE,
  ISP_BILLING_DOCUMENT_CUSTOMER_REQUIRED,
  ISP_BILLING_DOCUMENT_TYPE_INVALID,
  ISP_BILLING_DOCUMENT_TYPE_LABELS,
  ISP_BILLING_LINE_TAX_RATES,
  ISP_BILLING_VAT_CONDITION_LABELS,
  isIspBillingLineTaxCode,
  type IspBillingDocumentType,
  type IspBillingLineTaxCode,
  type IspBillingVatCondition,
} from "@/lib/isp/billing-constants"
import {
  formatCuit,
  isFiscalBillingDocument,
  isIspBillingDocumentType,
  isValidArCuit,
  normalizeCuitDigits,
  type BillingValidationIssue,
} from "@/lib/isp/billing-integrity"
import {
  ISP_BILLING_AUTHORIZATION_STATUSES,
  ISP_BILLING_CUSTOMER_DOCUMENT_TYPES,
  ISP_BILLING_DOCUMENT_EVENT_TYPES,
  ISP_BILLING_DOCUMENT_STATUSES,
  type IspBillingAuthorizationStatus,
  type IspBillingCustomerDocumentType,
  type IspBillingDocument,
  type IspBillingDocumentDraftInput,
  type IspBillingDocumentEventType,
  type IspBillingDocumentItem,
  type IspBillingDocumentItemDraft,
  type IspBillingDocumentStatus,
  type IspBillingPartySnapshot,
} from "@/lib/isp/billing-document-types"
import type { VisualTone } from "@/lib/ui/visual-tokens"

export function roundBillingMoney(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function parseBillingMoney(value: number | string | null | undefined): number {
  if (typeof value === "number") return roundBillingMoney(value)
  if (value == null) return 0
  const normalized = String(value).trim().replace(",", ".")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? roundBillingMoney(parsed) : 0
}

export function parseBillingQuantity(
  value: number | string | null | undefined
): number {
  const parsed = parseBillingMoney(value)
  return parsed > 0 ? parsed : 0
}

const BILLING_NUMBER_PATTERN = /^-?\d+([.,]\d*)?$/

export function isValidBillingNumberInput(
  value: number | string | null | undefined,
  options?: { emptyMeansZero?: boolean }
): boolean {
  if (typeof value === "number") return Number.isFinite(value)
  if (value == null) return Boolean(options?.emptyMeansZero)
  const trimmed = String(value).trim()
  if (!trimmed) return Boolean(options?.emptyMeansZero)
  if (!BILLING_NUMBER_PATTERN.test(trimmed)) return false
  const parsed = Number(trimmed.replace(",", "."))
  return Number.isFinite(parsed)
}

const KNOWN_LINE_TAX_RATES: ReadonlyArray<{
  rate: number
  code: IspBillingLineTaxCode
}> = [
  { rate: 21, code: "iva_21" },
  { rate: 10.5, code: "iva_105" },
  { rate: 27, code: "iva_27" },
]

function ratesMatch(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.0001
}

export function resolveIspBillingLineTax(input: {
  taxType?: string | null
  taxRate?: number | string | null
}): { taxType: IspBillingLineTaxCode; taxRate: number } {
  const rawType = String(input.taxType ?? "").trim()
  if (isIspBillingLineTaxCode(rawType)) {
    return {
      taxType: rawType,
      taxRate: ISP_BILLING_LINE_TAX_RATES[rawType],
    }
  }

  const rate = parseBillingMoney(input.taxRate)
  const known = KNOWN_LINE_TAX_RATES.find((entry) =>
    ratesMatch(entry.rate, rate)
  )
  if (known) {
    return { taxType: known.code, taxRate: known.rate }
  }

  return {
    taxType: ISP_BILLING_DEFAULT_LINE_TAX_CODE,
    taxRate: 0,
  }
}

export function formatIspBillingIvaRateLabel(rate: number): string {
  const formatted = new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(roundBillingMoney(rate))
  return `IVA ${formatted}%`
}

export function formatBillingMoney(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(roundBillingMoney(value))
}

export function formatBillingDocumentNumber(
  pointOfSaleNumber: number,
  number: number
): string {
  return `${String(pointOfSaleNumber).padStart(4, "0")}-${String(number).padStart(8, "0")}`
}

export function isIspBillingDocumentStatus(
  value: string
): value is IspBillingDocumentStatus {
  return (ISP_BILLING_DOCUMENT_STATUSES as readonly string[]).includes(value)
}

export function isIspBillingAuthorizationStatus(
  value: string
): value is IspBillingAuthorizationStatus {
  return (ISP_BILLING_AUTHORIZATION_STATUSES as readonly string[]).includes(
    value
  )
}

export function isIspBillingCustomerDocumentType(
  value: string
): value is IspBillingCustomerDocumentType {
  return (ISP_BILLING_CUSTOMER_DOCUMENT_TYPES as readonly string[]).includes(
    value
  )
}

export function isIspBillingDocumentEventType(
  value: string
): value is IspBillingDocumentEventType {
  return (ISP_BILLING_DOCUMENT_EVENT_TYPES as readonly string[]).includes(value)
}

export function defaultAuthorizationStatus(
  documentType: IspBillingDocumentType
): IspBillingAuthorizationStatus {
  return isFiscalBillingDocument(documentType)
    ? "pending_integration"
    : "not_required"
}

export function calculateBillingLine(input: {
  quantity: number | string
  unitPrice: number | string
  discount?: number | string | null
  taxAmount?: number | string | null
  taxType?: string | null
  taxRate?: number | string | null
}): {
  quantity: number
  unitPrice: number
  discount: number
  gross: number
  taxableBase: number
  taxAmount: number
  taxType: IspBillingLineTaxCode
  taxRate: number
  lineTotal: number
} {
  const quantity = parseBillingQuantity(input.quantity)
  const unitPrice = Math.max(0, parseBillingMoney(input.unitPrice))
  const discount = Math.max(0, parseBillingMoney(input.discount))
  const gross = roundBillingMoney(quantity * unitPrice)
  const boundedDiscount = Math.min(discount, gross)
  const taxableBase = roundBillingMoney(gross - boundedDiscount)
  const tax = resolveIspBillingLineTax({
    taxType: input.taxType,
    taxRate: input.taxRate,
  })
  const taxAmount =
    tax.taxRate > 0
      ? roundBillingMoney((taxableBase * tax.taxRate) / 100)
      : 0
  return {
    quantity,
    unitPrice,
    discount: boundedDiscount,
    gross,
    taxableBase,
    taxAmount,
    taxType: tax.taxType,
    taxRate: tax.taxRate,
    lineTotal: taxableBase,
  }
}

export function calculateBillingTotals(
  items: Array<{
    quantity: number | string
    unitPrice: number | string
    discount?: number | string | null
    taxAmount?: number | string | null
    taxType?: string | null
    taxRate?: number | string | null
  }>
): {
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
  lines: ReturnType<typeof calculateBillingLine>[]
} {
  const lines = items.map((item) => calculateBillingLine(item))
  const subtotal = roundBillingMoney(
    lines.reduce((sum, line) => sum + line.gross, 0)
  )
  const discountTotal = roundBillingMoney(
    lines.reduce((sum, line) => sum + line.discount, 0)
  )
  const taxTotal = roundBillingMoney(
    lines.reduce((sum, line) => sum + line.taxAmount, 0)
  )
  const total = roundBillingMoney(subtotal - discountTotal + taxTotal)
  return { subtotal, discountTotal, taxTotal, total, lines }
}

export function snapshotCustomerFromRecord(input: {
  name?: string | null
  dni?: string | null
  email?: string | null
  address?: string | null
  locality?: string | null
}): IspBillingPartySnapshot {
  const digits = normalizeCuitDigits(input.dni ?? "")
  const isCuit = digits.length === 11 && isValidArCuit(digits)
  return {
    name: (input.name ?? "").trim(),
    documentType: isCuit ? "cuit" : "dni",
    documentNumber: isCuit ? formatCuit(digits) : (input.dni ?? "").trim(),
    taxId: isCuit ? formatCuit(digits) : "",
    vatCondition: "",
    taxAddress: (input.address ?? "").trim(),
    city: (input.locality ?? "").trim(),
    province: "",
    postalCode: "",
    email: (input.email ?? "").trim(),
  }
}

export function snapshotDiffersFromLiveCustomer(
  snapshot: Pick<
    IspBillingDocument,
    "customerNameSnapshot" | "customerDocumentNumberSnapshot" | "customerEmailSnapshot"
  >,
  live: { name?: string | null; dni?: string | null; email?: string | null }
): boolean {
  const current = snapshotCustomerFromRecord(live)
  return (
    snapshot.customerNameSnapshot !== current.name ||
    snapshot.customerDocumentNumberSnapshot !== current.documentNumber ||
    snapshot.customerEmailSnapshot !== current.email
  )
}

export function canEditBillingDocument(status: IspBillingDocumentStatus): boolean {
  return status === "draft"
}

export function canIssueBillingDocument(status: IspBillingDocumentStatus): boolean {
  return status === "draft"
}

export function canCancelBillingDocument(status: IspBillingDocumentStatus): boolean {
  return status === "draft" || status === "issued"
}

export function billingDocumentRequiresCae(
  documentType: IspBillingDocumentType
): boolean {
  return isFiscalBillingDocument(documentType)
}

export function displayBillingDocumentStatus(input: {
  status: IspBillingDocumentStatus
  documentType: IspBillingDocumentType
  authorizationStatus: IspBillingAuthorizationStatus
}): { label: string; tone: VisualTone } {
  if (input.status === "cancelled") {
    return { label: "Anulado", tone: "red" }
  }
  if (input.status === "draft") {
    return { label: "Borrador", tone: "gray" }
  }
  if (input.status === "pending_authorization") {
    return { label: "Pendiente autorización", tone: "yellow" }
  }
  if (input.status === "authorized") {
    return { label: "Autorizado", tone: "green" }
  }
  if (input.status === "rejected") {
    return { label: "Rechazado", tone: "red" }
  }
  if (
    isFiscalBillingDocument(input.documentType) &&
    (input.authorizationStatus === "pending_integration" ||
      input.authorizationStatus === "pending")
  ) {
    return { label: ISP_BILLING_DOCUMENT_ISSUED_PENDING_LABEL, tone: "blue" }
  }
  return { label: "Emitido", tone: "blue" }
}

export function vatConditionLabel(value: string | null | undefined): string {
  if (!value) return "—"
  if (value in ISP_BILLING_VAT_CONDITION_LABELS) {
    return ISP_BILLING_VAT_CONDITION_LABELS[value as IspBillingVatCondition]
  }
  return value
}

export function validateBillingDocumentDraft(
  draft: IspBillingDocumentDraftInput
): BillingValidationIssue[] {
  const issues: BillingValidationIssue[] = []

  if (!isIspBillingDocumentType(draft.documentType)) {
    issues.push({ field: "documentType", message: ISP_BILLING_DOCUMENT_TYPE_INVALID })
  }

  if (!draft.customerId?.trim()) {
    issues.push({ field: "customerId", message: ISP_BILLING_DOCUMENT_CUSTOMER_REQUIRED })
  }

  if (!draft.items?.length) {
    issues.push({ field: "items", message: ISP_BILLING_DOCUMENT_ITEMS_REQUIRED })
  }

  for (const [index, item] of (draft.items ?? []).entries()) {
    if (!String(item.description ?? "").trim()) {
      issues.push({
        field: `items.${index}.description`,
        message: ISP_BILLING_DOCUMENT_ITEM_DESCRIPTION_REQUIRED,
      })
    }
    const quantityValid = isValidBillingNumberInput(item.quantity, {
      emptyMeansZero: false,
    })
    if (!quantityValid) {
      issues.push({
        field: `items.${index}.quantity`,
        message: ISP_BILLING_DOCUMENT_ITEM_QUANTITY_INVALID,
      })
    } else if (parseBillingQuantity(item.quantity) <= 0) {
      issues.push({
        field: `items.${index}.quantity`,
        message: ISP_BILLING_DOCUMENT_ITEM_QUANTITY_POSITIVE,
      })
    }

    const unitPriceValid = isValidBillingNumberInput(item.unitPrice, {
      emptyMeansZero: true,
    })
    if (!unitPriceValid) {
      issues.push({
        field: `items.${index}.unitPrice`,
        message: ISP_BILLING_DOCUMENT_ITEM_UNIT_PRICE_INVALID,
      })
    } else if (parseBillingMoney(item.unitPrice) < 0) {
      issues.push({
        field: `items.${index}.unitPrice`,
        message: ISP_BILLING_DOCUMENT_ITEM_UNIT_PRICE_NEGATIVE,
      })
    }

    const discountValid = isValidBillingNumberInput(item.discount, {
      emptyMeansZero: true,
    })
    if (!discountValid) {
      issues.push({
        field: `items.${index}.discount`,
        message: ISP_BILLING_DOCUMENT_ITEM_DISCOUNT_INVALID,
      })
    } else if (parseBillingMoney(item.discount) < 0) {
      issues.push({
        field: `items.${index}.discount`,
        message: ISP_BILLING_DOCUMENT_ITEM_DISCOUNT_NEGATIVE,
      })
    } else if (
      quantityValid &&
      unitPriceValid &&
      parseBillingQuantity(item.quantity) > 0 &&
      parseBillingMoney(item.unitPrice) >= 0
    ) {
      const gross = roundBillingMoney(
        parseBillingQuantity(item.quantity) *
          parseBillingMoney(item.unitPrice)
      )
      if (parseBillingMoney(item.discount) > gross) {
        issues.push({
          field: `items.${index}.discount`,
          message: ISP_BILLING_DOCUMENT_ITEM_DISCOUNT_EXCEEDS,
        })
      }
    }

    const taxType = String(item.taxType ?? "").trim()
    if (taxType && !isIspBillingLineTaxCode(taxType)) {
      issues.push({
        field: `items.${index}.taxType`,
        message: ISP_BILLING_DOCUMENT_ITEM_TAX_INVALID,
      })
    }
  }

  return issues
}

export function suggestedServiceConcept(input: {
  planName: string
  catalogCode?: string | null
}): string {
  const code = input.catalogCode?.trim()
  if (code) return `Abono ${code}`
  return `Abono ${input.planName}`.trim()
}

export function emptyDocumentItemDraft(): IspBillingDocumentItemDraft {
  return {
    description: "",
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    taxType: ISP_BILLING_DEFAULT_LINE_TAX_CODE,
    serviceId: null,
  }
}

export function todayIsoDate(reference = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${reference.getFullYear()}-${pad(reference.getMonth() + 1)}-${pad(reference.getDate())}`
}

export function documentTypeLabel(type: IspBillingDocumentType): string {
  return ISP_BILLING_DOCUMENT_TYPE_LABELS[type]
}

export function itemsFromDraft(
  items: readonly IspBillingDocumentItemDraft[]
): Pick<
  IspBillingDocumentItem,
  | "description"
  | "quantity"
  | "unitPrice"
  | "discount"
  | "taxType"
  | "taxRate"
  | "serviceId"
  | "sortOrder"
>[] {
  return items.map((item, index) => {
    const line = calculateBillingLine({
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      taxType: item.taxType,
      taxRate: item.taxRate,
    })
    return {
      description: String(item.description ?? "").trim(),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount: line.discount,
      taxType: line.taxType,
      taxRate: line.taxRate,
      serviceId: item.serviceId?.trim() ? item.serviceId : null,
      sortOrder: index,
    }
  })
}
