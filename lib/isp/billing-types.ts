import type {
  IspBillingDocumentType,
  IspBillingIntegrationEnvironment,
  IspBillingIntegrationProvider,
  IspBillingIntegrationStatus,
  IspBillingVatCondition,
} from "@/lib/isp/billing-constants"

export type IspBillingPointOfSale = {
  id: string
  companyId: string
  number: number
  description: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export type IspBillingPointOfSaleDraft = {
  id?: string
  number: string
  description: string
  active: boolean
}

export type IspBillingDocumentSequence = {
  id: string
  companyId: string
  pointOfSaleId: string
  documentType: IspBillingDocumentType
  nextNumber: number
  issuedCount: number
  createdAt: string
  updatedAt: string
}

export type IspBillingDocumentSequenceDraft = {
  documentType: IspBillingDocumentType
  nextNumber: string
}

export type IspBillingIntegration = {
  provider: IspBillingIntegrationProvider
  status: IspBillingIntegrationStatus
  environment: IspBillingIntegrationEnvironment | null
  lastSyncAt: string | null
}

export type IspBillingCompanySettings = {
  id: string
  companyId: string
  legalName: string
  taxId: string
  vatCondition: IspBillingVatCondition | null
  taxAddress: string
  city: string
  province: string
  postalCode: string
  phone: string
  email: string
  website: string
  logoUrl: string | null
  active: boolean
  createdAt: string
  updatedAt: string
  pointOfSale: IspBillingPointOfSale | null
  sequences: IspBillingDocumentSequence[]
  integrations: IspBillingIntegration[]
}

export type IspBillingCompanySettingsDraft = {
  legalName: string
  taxId: string
  vatCondition: IspBillingVatCondition | ""
  taxAddress: string
  city: string
  province: string
  postalCode: string
  phone: string
  email: string
  website: string
  logoUrl: string
  pointOfSale: IspBillingPointOfSaleDraft
  sequences: IspBillingDocumentSequenceDraft[]
}

export type IspBillingMissingField = {
  code:
    | "legal_name"
    | "tax_id"
    | "vat_condition"
    | "tax_address"
    | "point_of_sale"
  message: string
}

export type IspBillingConfigurationStatus = {
  companyReady: boolean
  pointOfSaleReady: boolean
  arcaStatus: IspBillingIntegrationStatus
  siroStatus: IspBillingIntegrationStatus
  incomplete: boolean
  missing: IspBillingMissingField[]
  labels: {
    company: string
    pointOfSale: string
    arca: string
    siro: string
  }
}

export type IspBillingSaveInput = IspBillingCompanySettingsDraft & {
  companyId?: string
}
