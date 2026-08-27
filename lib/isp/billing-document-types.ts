import type {
  IspBillingDocumentType,
  IspBillingVatCondition,
} from "@/lib/isp/billing-constants"

export const ISP_BILLING_DOCUMENT_STATUSES = [
  "draft",
  "issued",
  "cancelled",
  "pending_authorization",
  "authorized",
  "rejected",
] as const

export type IspBillingDocumentStatus =
  (typeof ISP_BILLING_DOCUMENT_STATUSES)[number]

export const ISP_BILLING_AUTHORIZATION_STATUSES = [
  "not_required",
  "pending_integration",
  "pending",
  "authorized",
  "rejected",
] as const

export type IspBillingAuthorizationStatus =
  (typeof ISP_BILLING_AUTHORIZATION_STATUSES)[number]

export const ISP_BILLING_CUSTOMER_DOCUMENT_TYPES = ["dni", "cuit"] as const
export type IspBillingCustomerDocumentType =
  (typeof ISP_BILLING_CUSTOMER_DOCUMENT_TYPES)[number]

export const ISP_BILLING_DOCUMENT_EVENT_TYPES = [
  "created",
  "updated",
  "issued",
  "cancelled",
] as const

export type IspBillingDocumentEventType =
  (typeof ISP_BILLING_DOCUMENT_EVENT_TYPES)[number]

export type IspBillingDocumentItem = {
  id: string
  companyId: string
  documentId: string
  serviceId: string | null
  description: string
  quantity: number
  unitPrice: number
  discount: number
  taxableBase: number
  taxAmount: number
  taxType: string
  taxRate: number
  lineTotal: number
  sortOrder: number
}

export type IspBillingDocumentItemDraft = {
  id?: string
  serviceId?: string | null
  description: string
  quantity: number | string
  unitPrice: number | string
  discount?: number | string
  taxType?: string | null
  taxRate?: number | string | null
}

export type IspBillingDocumentEvent = {
  id: string
  eventType: IspBillingDocumentEventType
  payload: Record<string, unknown>
  createdAt: string
}

export type IspBillingDocument = {
  id: string
  companyId: string
  billingCompanySettingsId: string
  pointOfSaleId: string
  documentType: IspBillingDocumentType
  status: IspBillingDocumentStatus
  authorizationStatus: IspBillingAuthorizationStatus
  issueDate: string
  dueDate: string | null
  number: number | null
  formattedNumber: string | null
  customerId: string
  subscriberId: string | null
  customerNameSnapshot: string
  customerDocumentTypeSnapshot: IspBillingCustomerDocumentType
  customerDocumentNumberSnapshot: string
  customerTaxIdSnapshot: string
  customerVatConditionSnapshot: string
  customerTaxAddressSnapshot: string
  customerCitySnapshot: string
  customerProvinceSnapshot: string
  customerPostalCodeSnapshot: string
  customerEmailSnapshot: string
  issuerLegalNameSnapshot: string
  issuerTaxIdSnapshot: string
  issuerVatConditionSnapshot: IspBillingVatCondition | string
  issuerTaxAddressSnapshot: string
  issuerCitySnapshot: string
  issuerProvinceSnapshot: string
  issuerPostalCodeSnapshot: string
  issuerPhoneSnapshot: string
  issuerEmailSnapshot: string
  issuerWebsiteSnapshot: string
  issuerLogoUrlSnapshot: string | null
  pointOfSaleNumber: number
  subtotal: number
  discountTotal: number
  taxTotal: number
  total: number
  observations: string
  cae: string | null
  caeExpiresAt: string | null
  billingRunId: string | null
  periodYear: number | null
  periodMonth: number | null
  createdAt: string
  updatedAt: string
  items: IspBillingDocumentItem[]
  events: IspBillingDocumentEvent[]
}

export type IspBillingDocumentListItem = {
  id: string
  documentType: IspBillingDocumentType
  status: IspBillingDocumentStatus
  authorizationStatus: IspBillingAuthorizationStatus
  issueDate: string
  formattedNumber: string | null
  customerNameSnapshot: string
  customerDocumentNumberSnapshot: string
  customerTaxIdSnapshot: string
  total: number
  pointOfSaleNumber: number
  displayStatusLabel: string
}

export type IspBillingDocumentDraftInput = {
  documentType: IspBillingDocumentType | string
  customerId: string
  subscriberId?: string | null
  issueDate?: string
  dueDate?: string | null
  observations?: string
  items: IspBillingDocumentItemDraft[]
  companyId?: string
  billingRunId?: string | null
  periodYear?: number | null
  periodMonth?: number | null
}

export type IspBillingDocumentListFilters = {
  search?: string
  documentType?: string
  status?: string
  dateFrom?: string
  dateTo?: string
  pointOfSaleId?: string
}

export type IspBillingPartySnapshot = {
  name: string
  documentType: IspBillingCustomerDocumentType
  documentNumber: string
  taxId: string
  vatCondition: string
  taxAddress: string
  city: string
  province: string
  postalCode: string
  email: string
}

export type IspBillingCustomerOption = {
  id: string
  subscriberId: string | null
  name: string
  dni: string | null
  customerNumber: string
  email: string | null
  address: string | null
  locality: string | null
  snapshot: IspBillingPartySnapshot
}

export type IspBillingServiceOption = {
  id: string
  customerId: string
  planName: string
  catalogCode: string | null
  monthlyFee: number | null
  commercialStatus: string
}

export type IspBillingIssueContext = {
  issuerLegalName: string
  issuerTaxId: string
  issuerVatCondition: string
  issuerTaxAddress: string
  issuerCity: string
  issuerProvince: string
  issuerPostalCode: string
  issuerLogoUrl: string | null
  pointOfSaleId: string
  pointOfSaleNumber: number
  companyReady: boolean
  pointOfSaleReady: boolean
  missing: string[]
}
