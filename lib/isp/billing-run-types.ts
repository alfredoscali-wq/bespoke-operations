import type { IspBillingDocumentType } from "@/lib/isp/billing-constants"

export const ISP_BILLING_RUN_STATUSES = [
  "preparing",
  "in_review",
  "with_errors",
  "confirmed",
  "cancelled",
] as const

export type IspBillingRunStatus = (typeof ISP_BILLING_RUN_STATUSES)[number]

export const ISP_BILLING_RUN_ITEM_STATUSES = [
  "ready",
  "error",
  "needs_review",
  "billed",
] as const

export type IspBillingRunItemStatus =
  (typeof ISP_BILLING_RUN_ITEM_STATUSES)[number]

export type IspBillingRunConcept = {
  kind: "monthly" | "proportional"
  description: string
  amount: number
  days?: number
  periodLabel: string
  serviceId: string
  contractedMonthlyAmount?: number
}

export type IspBillingRunItem = {
  id: string
  runId: string
  companyId: string
  customerId: string
  subscriberId: string | null
  serviceId: string
  documentType: IspBillingDocumentType | null
  status: IspBillingRunItemStatus
  customerName: string
  serviceName: string
  catalogCode: string | null
  activationDate: string | null
  listPrice: number | null
  monthlyAmount: number
  contractedMonthlyAmount: number
  proportionalDays: number
  proportionalAmount: number
  proportionalPeriodLabel: string
  totalAmount: number
  errorCode: string | null
  errorMessage: string | null
  suggestedAction: string | null
  warningCode: string | null
  warningMessage: string | null
  requiresReview: boolean
  concepts: IspBillingRunConcept[]
  documentId: string | null
  createdAt: string
}

export type IspBillingRun = {
  id: string
  companyId: string
  periodYear: number
  periodMonth: number
  status: IspBillingRunStatus
  preparedAt: string | null
  confirmedAt: string | null
  cancelledAt: string | null
  totalCustomers: number
  totalDocuments: number
  totalAmount: number
  proportionalDocuments: number
  errorsCount: number
  warningsCount: number
  createdBy: string | null
  confirmedBy: string | null
  createdAt: string
  updatedAt: string
}

export type IspBillingRunGroup = {
  customerId: string
  subscriberId: string | null
  customerName: string
  documentType: IspBillingDocumentType | null
  status: IspBillingRunItemStatus
  monthlyAmount: number
  proportionalAmount: number
  totalAmount: number
  hasProportional: boolean
  hasError: boolean
  requiresReview: boolean
  errorMessage: string | null
  suggestedAction: string | null
  warningMessage: string | null
  items: IspBillingRunItem[]
  concepts: IspBillingRunConcept[]
}

export type IspBillingRunTypeSummary = {
  documentType: IspBillingDocumentType
  count: number
  totalAmount: number
  proportionalCount: number
  warningCount: number
  errorCount: number
}

export type IspBillingRunDetail = {
  run: IspBillingRun
  items: IspBillingRunItem[]
  groups: IspBillingRunGroup[]
  typeSummaries: IspBillingRunTypeSummary[]
  canConfirm: boolean
}

export type IspBillingServiceForRun = {
  id: string
  customerId: string
  subscriberId: string | null
  customerName: string
  customerDni: string | null
  customerEmail: string | null
  customerAddress: string | null
  customerLocality: string | null
  planName: string
  catalogCode: string | null
  monthlyFee: number | null
  listPrice: number | null
  activationDate: string | null
  commercialStatus: string
}

export type DetermineDocumentTypeInput = {
  issuerVatCondition: string | null | undefined
  customerName: string
  customerDocumentNumber: string | null | undefined
  customerVatCondition?: string | null
}
