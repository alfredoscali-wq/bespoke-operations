import type {
  SubscriptionCommissionStatus,
  SubscriptionCustomerStatus,
  SubscriptionSaleStatus,
} from "@/lib/subscriptions/statuses"

export type SubscriptionService = {
  id: string
  companyId: string
  name: string
  description: string
  monthlyPrice: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type SubscriptionCustomer = {
  id: string
  companyId: string
  serviceId: string
  firstName: string
  lastName: string
  dni: string
  email: string
  phone: string
  address: string
  city: string
  status: SubscriptionCustomerStatus
  activationDate: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  serviceName?: string
}

export type SubscriptionSale = {
  id: string
  companyId: string
  customerId: string
  serviceId: string
  sellerEmployeeId: string | null
  saleDate: string
  monthlyPrice: number
  firstInvoiceAmount: number
  status: SubscriptionSaleStatus
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  customerName?: string
  serviceName?: string
  sellerName?: string
}

export type SubscriptionCommission = {
  id: string
  companyId: string
  saleId: string
  employeeId: string
  commissionAmount: number
  status: SubscriptionCommissionStatus
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  employeeName?: string
  customerName?: string
}

export type CreateSubscriptionPreAltaInput = {
  companyId: string
  serviceId: string
  firstName: string
  lastName: string
  dni: string
  phone: string
  email?: string
  address?: string
  city?: string
  activationDate: string
  sellerEmployeeId?: string | null
  commissionAmount?: number
}

export type SubscriptionDashboardSummary = {
  activeSubscribers: number
  pendingPayment: number
  pendingActivation: number
  signupsThisMonth: number
  expectedBilling: number
}
