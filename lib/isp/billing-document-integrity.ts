import {
  ISP_BILLING_DOCUMENT_ISSUED_PENDING_LABEL,
  ISP_BILLING_DOCUMENT_ITEMS_REQUIRED,
  ISP_BILLING_DOCUMENT_ITEM_DESCRIPTION_REQUIRED,
  ISP_BILLING_DOCUMENT_CUSTOMER_REQUIRED,
  ISP_BILLING_DOCUMENT_TYPE_INVALID,
  ISP_BILLING_DOCUMENT_TYPE_LABELS,
  ISP_BILLING_VAT_CONDITION_LABELS,
  type IspBillingDocumentType,
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
  quantity: number
  unitPrice: number
  discount?: number
  taxAmount?: number
  taxRate?: number
}): {
  quantity: number
  unitPrice: number
  discount: number
  gross: number
  taxableBase: number
  taxAmount: number
  taxRate: number
  lineTotal: number
} {
  const quantity = parseBillingQuantity(input.quantity)
  const unitPrice = Math.max(0, parseBillingMoney(input.unitPrice))
  const discount = Math.max(0, parseBillingMoney(input.discount))
  const gross = roundBillingMoney(quantity * unitPrice)
  const boundedDiscount = Math.min(discount, gross)
  const taxableBase = roundBillingMoney(gross - boundedDiscount)
  const taxAmount = 0
  const taxRate = 0
  return {
    quantity,
    unitPrice,
    discount: boundedDiscount,
    gross,
    taxableBase,
    taxAmount,
    taxRate,
    lineTotal: taxableBase,
  }
}

export function calculateBillingTotals(
  items: Array<{
    quantity: number
    unitPrice: number
    discount?: number
    taxAmount?: number
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
  const taxTotal = 0
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
    if (parseBillingQuantity(item.quantity) <= 0) {
      issues.push({
        field: `items.${index}.quantity`,
        message: "La cantidad debe ser mayor a 0.",
      })
    }
    if (parseBillingMoney(item.unitPrice) < 0) {
      issues.push({
        field: `items.${index}.unitPrice`,
        message: "El precio unitario no puede ser negativo.",
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
): Pick<IspBillingDocumentItem, "description" | "quantity" | "unitPrice" | "discount" | "serviceId" | "sortOrder">[] {
  return items.map((item, index) => {
    const line = calculateBillingLine({
      quantity: parseBillingQuantity(item.quantity),
      unitPrice: parseBillingMoney(item.unitPrice),
      discount: parseBillingMoney(item.discount),
    })
    return {
      description: String(item.description ?? "").trim(),
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount: line.discount,
      serviceId: item.serviceId?.trim() ? item.serviceId : null,
      sortOrder: index,
    }
  })
}
