import type {
  SubscriptionCommission,
  SubscriptionCustomer,
  SubscriptionSale,
  SubscriptionService,
} from "@/lib/types/subscriptions"
import type {
  SubscriptionCommissionStatus,
  SubscriptionCustomerStatus,
  SubscriptionSaleStatus,
} from "@/lib/subscriptions/statuses"

function toNumber(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

export type SubscriptionServiceRow = {
  id: string
  company_id: string
  name: string
  description: string
  monthly_price: number | string
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type SubscriptionCustomerRow = {
  id: string
  company_id: string
  service_id: string
  first_name: string
  last_name: string
  dni: string
  email: string
  phone: string
  address: string
  city: string
  status: string
  activation_date: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  service?: { name: string } | null
}

export type SubscriptionSaleRow = {
  id: string
  company_id: string
  customer_id: string
  service_id: string
  seller_employee_id: string | null
  sale_date: string
  monthly_price: number | string
  first_invoice_amount: number | string
  status: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  customer?: { first_name: string; last_name: string } | null
  service?: { name: string } | null
  seller?: {
    first_name: string
    last_name: string
    preferred_name: string | null
  } | null
}

export type SubscriptionCommissionRow = {
  id: string
  company_id: string
  sale_id: string
  employee_id: string
  commission_amount: number | string
  status: string
  created_at: string
  updated_at: string
  deleted_at: string | null
  employee?: {
    first_name: string
    last_name: string
    preferred_name: string | null
  } | null
  sale?: {
    customer?: { first_name: string; last_name: string } | null
  } | null
}

function formatPersonName(
  person:
    | {
        first_name?: string
        last_name?: string
        preferred_name?: string | null
      }
    | null
    | undefined
): string {
  if (!person) return ""
  const preferred = person.preferred_name?.trim()
  if (preferred) return preferred
  return [person.last_name, person.first_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ")
}

export function mapSubscriptionServiceRow(
  row: SubscriptionServiceRow
): SubscriptionService {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    description: row.description ?? "",
    monthlyPrice: toNumber(row.monthly_price),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

export function mapSubscriptionCustomerRow(
  row: SubscriptionCustomerRow
): SubscriptionCustomer {
  return {
    id: row.id,
    companyId: row.company_id,
    serviceId: row.service_id,
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    dni: row.dni ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    city: row.city ?? "",
    status: row.status as SubscriptionCustomerStatus,
    activationDate: row.activation_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    serviceName: row.service?.name,
  }
}

export function mapSubscriptionSaleRow(row: SubscriptionSaleRow): SubscriptionSale {
  const customerName = row.customer
    ? [row.customer.last_name, row.customer.first_name]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(", ")
    : ""

  return {
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    serviceId: row.service_id,
    sellerEmployeeId: row.seller_employee_id,
    saleDate: row.sale_date,
    monthlyPrice: toNumber(row.monthly_price),
    firstInvoiceAmount: toNumber(row.first_invoice_amount),
    status: row.status as SubscriptionSaleStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    customerName,
    serviceName: row.service?.name,
    sellerName: formatPersonName(row.seller),
  }
}

export function mapSubscriptionCommissionRow(
  row: SubscriptionCommissionRow
): SubscriptionCommission {
  const customer = row.sale?.customer
  const customerName = customer
    ? [customer.last_name, customer.first_name]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(", ")
    : ""

  return {
    id: row.id,
    companyId: row.company_id,
    saleId: row.sale_id,
    employeeId: row.employee_id,
    commissionAmount: toNumber(row.commission_amount),
    status: row.status as SubscriptionCommissionStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    employeeName: formatPersonName(row.employee),
    customerName,
  }
}
