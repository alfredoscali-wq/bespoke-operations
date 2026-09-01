import type { IspConnectionType, IspTechnology } from "@/lib/isp/constants"
import type {
  IspCatalogBillingMethod,
  IspCatalogBillingPeriod,
  IspCatalogConnectionType,
  IspCatalogCustomerType,
  IspCatalogTechnology,
} from "@/lib/isp/catalog-constants"
import type { WorkOrderTechnology } from "@/lib/tasks/commercial-plan"

export type IspTechnicalProfile = {
  id: string
  companyId: string
  code: string
  name: string
  description: string | null
  technology: IspCatalogTechnology | null
  connectionType: IspCatalogConnectionType | null
  downloadSpeed: number | null
  uploadSpeed: number | null
  speedUnit: string
  coreName: string | null
  coreProfileId: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type IspTechnicalProfileDraft = {
  code: string
  name: string
  description: string
  technology: IspCatalogTechnology | ""
  connectionType: IspCatalogConnectionType | ""
  downloadSpeed: string
  uploadSpeed: string
  speedUnit: string
  coreName: string
  coreProfileId: string
  isActive: boolean
}

export type IspCatalogTvPlan = {
  id: string
  companyId: string
  code: string | null
  name: string
  monthlyPrice: number | null
  isActive: boolean
}

export type IspCatalogItem = {
  id: string
  companyId: string
  code: string | null
  name: string
  externalCode?: string | null
  category: string
  customerType: IspCatalogCustomerType
  description: string | null
  isActive: boolean
  technology: IspCatalogTechnology | null
  downloadSpeedMbps: number | null
  uploadSpeedMbps: number | null
  speedUnit: string
  monthlyPrice: number | null
  currency: string
  priceIsConfigurable: boolean
  billingPeriod: IspCatalogBillingPeriod
  billingMethod: IspCatalogBillingMethod
  requiresConnection: boolean
  allowedConnectionTypes: IspCatalogConnectionType[]
  technicalProfileId: string | null
  technicalProfile?: IspTechnicalProfile | null
  tvPlanCatalogId: string | null
  tvPlan?: IspCatalogTvPlan | null
  otLabel: string | null
  legacyPlanCode: string | null
  isSeed: boolean
  createdAt: string
  updatedAt: string
  usedCount?: number
  canPhysicallyDelete?: boolean
}

export type IspCatalogDraft = {
  code: string
  name: string
  category: string
  customerType: IspCatalogCustomerType | ""
  description: string
  isActive: boolean
  technology: IspCatalogTechnology | ""
  downloadSpeedMbps: string
  uploadSpeedMbps: string
  speedUnit: string
  monthlyPrice: string
  currency: string
  priceIsConfigurable: boolean
  billingPeriod: IspCatalogBillingPeriod
  billingMethod: IspCatalogBillingMethod
  requiresConnection: boolean
  allowedConnectionTypes: IspCatalogConnectionType[]
  technicalProfileId: string
  createTechnicalProfile: boolean
  technicalProfile: IspTechnicalProfileDraft
  otLabel: string
  includesTv: boolean
  tvPlanCatalogId: string
}

export type IspCatalogListFilters = {
  search?: string
  category?: string | "all"
  customerType?: IspCatalogCustomerType | "all"
  technology?: IspCatalogTechnology | "none" | "all"
  status?: "active" | "inactive" | "all"
}

export type IspOtPlanOption = {
  catalogId: string
  label: string
  contractedPlanCode: string
  technology: WorkOrderTechnology
  downloadSpeedMbps: number | null
  monthlyPrice: number | null
  allowedConnectionTypes: IspConnectionType[]
  requiresConnection: boolean
  isActive: boolean
}

export type IspCatalogServiceSnapshot = {
  catalogId: string
  catalogCode: string
  planName: string
  technology: IspTechnology | ""
  contractedSpeed: string
  downloadSpeed: number | null
  uploadSpeed: number | null
  speedUnit: string
  monthlyFee: string
  listPrice: string
  monthlyCollectionMethod: "pending" | "siro"
  allowedConnectionTypes: IspConnectionType[]
  requiresConnection: boolean
  technicalProfileId: string | null
}
