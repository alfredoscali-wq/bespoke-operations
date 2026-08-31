import type { IspCommercialStatus } from "@/lib/isp/constants"

export type TvCatalogPlan = {
  id: string
  companyId: string
  code: string
  name: string
  monthlyPrice: number
  category: "tv"
  requiresConnection: boolean
  billingMethod: string
  isActive: boolean
  usedCount: number
}

export type TvSubscriberRow = {
  serviceId: string
  customerId: string
  companyId: string
  customerName: string
  phone: string
  locality: string
  dni: string
  customerNumber: string
  commercialPlanName: string
  commercialCatalogId: string
  tvPlanCatalogId: string
  planCode: string
  planName: string
  monthlyPrice: number
  commercialStatus: IspCommercialStatus
  activationDate: string | null
}

export type TvSubscriberListPage = {
  items: TvSubscriberRow[]
  total: number
  page: number
  pageSize: number
}
