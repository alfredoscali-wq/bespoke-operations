import type { IspCatalogCategory } from "@/lib/isp/catalog-constants"
import type {
  IspCommercialStatus,
  IspConnectionType,
  IspMonthlyCollectionMethod,
  IspTechnicalStatus,
  IspTechnology,
} from "@/lib/isp/constants"

export type IspCustomerListItem = {
  id: string
  name: string
  dni: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  locality: string | null
  status: string
  createdAt: string
  externalCustomerCode?: string | null
  serviceCount: number
  connectionCount: number
  serviceOverview: string
  listStatus: "activo" | "suspendido" | "baja" | "pendiente"
  accountSituation: string | null
  lastActivityAt: string | null
}

export type IspService = {
  id: string
  companyId: string
  customerId: string
  catalogId: string | null
  catalogCode: string | null
  externalCode?: string | null
  technology: IspTechnology | null
  planName: string
  contractedSpeed: string | null
  downloadSpeed: number | null
  uploadSpeed: number | null
  speedUnit: string | null
  listPrice: number | null
  monthlyFee: number | null
  activationDate: string | null
  commercialStatus: IspCommercialStatus
  monthlyCollectionMethod: IspMonthlyCollectionMethod
  sourceTaskId: string | null
  notes: string | null
  replacedServiceId: string | null
  createdAt: string
  updatedAt: string
}

export type IspConnection = {
  id: string
  companyId: string
  serviceId: string
  customerId: string
  externalCode?: string | null
  notes?: string | null
  connectionType: IspConnectionType
  pppoeUsername: string | null
  pppoePassword: string | null
  pppoePasswordSet: boolean
  technicalProfile: string | null
  technicalProfileId: string | null
  ipAddress: string | null
  prefixLength: number | null
  gateway: string | null
  vlan: string | null
  coreName: string | null
  coreProfileId: string | null
  technicalStatus: IspTechnicalStatus
  lastSyncAt: string | null
  provisionError: string | null
  sourceTaskId: string | null
  createdAt: string
  updatedAt: string
}

export type IspServiceWithConnection = IspService & {
  connection: IspConnection | null
  catalogCategory: IspCatalogCategory | null
}

export type IspCustomerHeader = {
  id: string
  name: string
  dni: string | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  address: string | null
  locality: string | null
  status: string
  createdAt: string
  updatedAt: string
  externalCustomerCode?: string | null
  technology?: string | null
}

export type IspCustomerKpis = {
  serviceCount: number
  connectionCount: number
  accountSituation: string | null
  pendingAtenciones: number | null
  lastWorkOrderLabel: string | null
}

export type IspWorkOrderSummary = {
  id: string
  code: string
  type: string | null
  status: string
  date: string | null
  technology: string | null
  plan: string | null
  crew: string | null
}

export type IspAtencionSummary = {
  id: string
  date: string
  motivo: string | null
  resultado: string | null
  status: string | null
  lastActivityAt: string | null
}

export type IspActivityEvent = {
  id: string
  occurredAt: string
  label: string
  kind: "work_order" | "atencion" | "service" | "connection" | "admin"
}

export type IspCustomerDetail = {
  customer: IspCustomerHeader
  kpis: IspCustomerKpis
  services: IspServiceWithConnection[]
  workOrders: IspWorkOrderSummary[]
  atenciones: IspAtencionSummary[]
  activity: IspActivityEvent[]
}

export type IspConnectionListItem = {
  id: string
  customerId: string
  customerName: string
  serviceId: string
  technology: IspTechnology | null
  planName: string
  connectionType: IspConnectionType
  ipAddress: string | null
  coreName: string | null
  commercialStatus: IspCommercialStatus
  technicalStatus: IspTechnicalStatus
  healthLabel: string
}

export type IspConnectionDetail = {
  customer: IspCustomerHeader
  service: IspService
  connection: IspConnection
}

export type IspCustomerDraft = {
  name: string
  dni: string
  phone: string
  whatsapp: string
  email: string
  address: string
  locality: string
  notes: string
}

export type IspServiceDraft = {
  catalogId: string
  technology: IspTechnology | ""
  planName: string
  contractedSpeed: string
  monthlyFee: string
  activationDate: string
  commercialStatus: IspCommercialStatus
  monthlyCollectionMethod: IspMonthlyCollectionMethod
}

export type IspConnectionDraft = {
  connectionType: IspConnectionType | ""
  pppoeUsername: string
  pppoePassword: string
  technicalProfile: string
  technicalProfileId?: string
  ipAddress: string
  prefixLength: string
  gateway: string
  vlan: string
  coreName: string
  coreProfileId?: string
  technicalStatus: IspTechnicalStatus
}

export type IspUnconnectedServiceOption = {
  id: string
  customerId: string
  customerName: string
  planName: string
  catalogId: string | null
  catalogCode: string | null
  commercialStatus: IspCommercialStatus
}

export type IspSubscriberServiceResult = {
  customerId: string
  serviceId: string
  connectionId: string | null
  replacedServiceId: string | null
}

export type IspOnboardingPayload = {
  reuseExistingCustomer?: boolean
  existingCustomerId?: string | null
  includeService: boolean
  includeConnection: boolean
  customer: IspCustomerDraft
  service: IspServiceDraft
  connection: IspConnectionDraft
  sourceTaskId?: string | null
}

export type IspExistingCustomerMatch = {
  id: string
  name: string
  dni: string | null
  phone: string | null
}

export type IspOtPrefill = {
  taskId: string
  taskCode: string
  isNewInstallation: boolean
  customer: Partial<IspCustomerDraft> & { existingCustomer?: IspExistingCustomerMatch | null }
  service: Partial<IspServiceDraft>
  connection: Partial<IspConnectionDraft>
  fromOt: {
    customer: boolean
    technology: boolean
    plan: boolean
    monthlyFee: boolean
    address: boolean
    connectionType: boolean
    ipAddress: boolean
  }
  otInstallationAmount: number | null
  otAmountToCollect: number | null
  otInstallationIp: string | null
  otPaymentMethod: string | null
  missingFields: string[]
}

export type IspOnboardingResult = {
  customerId: string
  serviceId: string | null
  connectionId: string | null
  reusedExistingCustomer: boolean
  existingCustomer?: IspExistingCustomerMatch | null
  requiresConfirmation?: boolean
}
