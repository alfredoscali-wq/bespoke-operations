import type { SupabaseClient } from "@supabase/supabase-js"

import { calculateProratedAmount } from "@/lib/subscriptions/proration"
import {
  canTransitionSubscriptionCustomer,
  SUBSCRIPTION_COMMISSION_STATUSES,
  SUBSCRIPTION_CUSTOMER_STATUSES,
  SUBSCRIPTION_SALE_STATUSES,
  type SubscriptionCommissionStatus,
  type SubscriptionCustomerStatus,
} from "@/lib/subscriptions/statuses"
import {
  mapSubscriptionCommissionRow,
  mapSubscriptionCustomerRow,
  mapSubscriptionSaleRow,
  mapSubscriptionServiceRow,
  type SubscriptionCommissionRow,
  type SubscriptionCustomerRow,
  type SubscriptionSaleRow,
  type SubscriptionServiceRow,
} from "@/lib/supabase/subscriptions.mapper"
import type { Database } from "@/lib/supabase/database.types"
import type {
  CreateSubscriptionPreAltaInput,
  SubscriptionCommission,
  SubscriptionCustomer,
  SubscriptionSale,
  SubscriptionService,
} from "@/lib/types/subscriptions"

export type SupabaseSubscriptionsClient = SupabaseClient<Database>

export type SubscriptionsRepositoryResult<T> =
  | { data: T; error: null }
  | { data: null; error: { code: string; message: string } }

function mapError(error: { code?: string; message: string }) {
  return {
    code: error.code ?? "UNKNOWN",
    message: error.message,
  }
}

const SERVICE_SELECT = "*" as const

const CUSTOMER_SELECT = `
  *,
  service:subscription_services!subscription_customers_service_id_fkey(name)
` as const

const SALE_SELECT = `
  *,
  customer:subscription_customers!subscription_sales_customer_id_fkey(
    first_name, last_name
  ),
  service:subscription_services!subscription_sales_service_id_fkey(name),
  seller:employees!subscription_sales_seller_employee_id_fkey(
    first_name, last_name, preferred_name
  )
` as const

const COMMISSION_SELECT = `
  *,
  employee:employees!subscription_commissions_employee_id_fkey(
    first_name, last_name, preferred_name
  ),
  sale:subscription_sales!subscription_commissions_sale_id_fkey(
    customer:subscription_customers!subscription_sales_customer_id_fkey(
      first_name, last_name
    )
  )
` as const

export async function fetchSubscriptionServices(
  client: SupabaseSubscriptionsClient,
  companyId: string
): Promise<SubscriptionsRepositoryResult<SubscriptionService[]>> {
  const { data, error } = await (client as SupabaseClient)
    .from("subscription_services")
    .select(SERVICE_SELECT)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("name", { ascending: true })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return {
    data: ((data ?? []) as SubscriptionServiceRow[]).map(
      mapSubscriptionServiceRow
    ),
    error: null,
  }
}

export async function fetchSubscriptionCustomers(
  client: SupabaseSubscriptionsClient,
  companyId: string
): Promise<SubscriptionsRepositoryResult<SubscriptionCustomer[]>> {
  const { data, error } = await (client as SupabaseClient)
    .from("subscription_customers")
    .select(CUSTOMER_SELECT)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return {
    data: ((data ?? []) as SubscriptionCustomerRow[]).map(
      mapSubscriptionCustomerRow
    ),
    error: null,
  }
}

export async function fetchSubscriptionSales(
  client: SupabaseSubscriptionsClient,
  companyId: string
): Promise<SubscriptionsRepositoryResult<SubscriptionSale[]>> {
  const { data, error } = await (client as SupabaseClient)
    .from("subscription_sales")
    .select(SALE_SELECT)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("sale_date", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return {
    data: ((data ?? []) as SubscriptionSaleRow[]).map(mapSubscriptionSaleRow),
    error: null,
  }
}

export async function fetchSubscriptionCommissions(
  client: SupabaseSubscriptionsClient,
  companyId: string
): Promise<SubscriptionsRepositoryResult<SubscriptionCommission[]>> {
  const { data, error } = await (client as SupabaseClient)
    .from("subscription_commissions")
    .select(COMMISSION_SELECT)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    return { data: null, error: mapError(error) }
  }

  return {
    data: ((data ?? []) as SubscriptionCommissionRow[]).map(
      mapSubscriptionCommissionRow
    ),
    error: null,
  }
}

function validatePreAltaInput(
  input: CreateSubscriptionPreAltaInput
): string | null {
  if (!input.companyId.trim()) return "companyId es obligatorio."
  if (!input.serviceId.trim()) return "El servicio es obligatorio."
  if (!input.firstName.trim()) return "El nombre es obligatorio."
  if (!input.lastName.trim()) return "El apellido es obligatorio."
  if (!input.dni.trim()) return "El DNI es obligatorio."
  if (!input.phone.trim()) return "El teléfono es obligatorio."
  if (!input.activationDate.trim()) return "La fecha de alta es obligatoria."
  return null
}

export async function createSubscriptionPreAlta(
  client: SupabaseSubscriptionsClient,
  input: CreateSubscriptionPreAltaInput
): Promise<
  SubscriptionsRepositoryResult<{
    customer: SubscriptionCustomer
    sale: SubscriptionSale
    commission: SubscriptionCommission | null
  }>
> {
  const validationError = validatePreAltaInput(input)
  if (validationError) {
    return {
      data: null,
      error: { code: "VALIDATION", message: validationError },
    }
  }

  const { data: serviceRow, error: serviceError } = await (
    client as SupabaseClient
  )
    .from("subscription_services")
    .select(SERVICE_SELECT)
    .eq("id", input.serviceId)
    .eq("company_id", input.companyId)
    .is("deleted_at", null)
    .maybeSingle()

  if (serviceError) {
    return { data: null, error: mapError(serviceError) }
  }
  if (!serviceRow) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Servicio no encontrado." },
    }
  }

  const service = mapSubscriptionServiceRow(
    serviceRow as SubscriptionServiceRow
  )
  const firstInvoiceAmount = calculateProratedAmount(
    service.monthlyPrice,
    input.activationDate
  )

  const { data: customerRow, error: customerError } = await (
    client as SupabaseClient
  )
    .from("subscription_customers")
    .insert({
      company_id: input.companyId,
      service_id: input.serviceId,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      dni: input.dni.trim(),
      email: input.email?.trim() ?? "",
      phone: input.phone.trim(),
      address: input.address?.trim() ?? "",
      city: input.city?.trim() ?? "",
      status: SUBSCRIPTION_CUSTOMER_STATUSES.PENDING_PAYMENT,
      activation_date: input.activationDate,
    })
    .select(CUSTOMER_SELECT)
    .single()

  if (customerError || !customerRow) {
    return {
      data: null,
      error: mapError(
        customerError ?? { message: "No se pudo crear la pre-alta." }
      ),
    }
  }

  const customer = mapSubscriptionCustomerRow(
    customerRow as SubscriptionCustomerRow
  )

  const sellerId = input.sellerEmployeeId?.trim() || null

  const { data: saleRow, error: saleError } = await (client as SupabaseClient)
    .from("subscription_sales")
    .insert({
      company_id: input.companyId,
      customer_id: customer.id,
      service_id: input.serviceId,
      seller_employee_id: sellerId,
      sale_date: input.activationDate,
      monthly_price: service.monthlyPrice,
      first_invoice_amount: firstInvoiceAmount,
      status: SUBSCRIPTION_SALE_STATUSES.OPEN,
    })
    .select(SALE_SELECT)
    .single()

  if (saleError || !saleRow) {
    await (client as SupabaseClient)
      .from("subscription_customers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", customer.id)

    return {
      data: null,
      error: mapError(
        saleError ?? { message: "No se pudo registrar la venta." }
      ),
    }
  }

  const sale = mapSubscriptionSaleRow(saleRow as SubscriptionSaleRow)
  let commission: SubscriptionCommission | null = null

  const commissionAmount = input.commissionAmount ?? 0
  if (sellerId && Number.isFinite(commissionAmount) && commissionAmount > 0) {
    const { data: commissionRow, error: commissionError } = await (
      client as SupabaseClient
    )
      .from("subscription_commissions")
      .insert({
        company_id: input.companyId,
        sale_id: sale.id,
        employee_id: sellerId,
        commission_amount: commissionAmount,
        status: SUBSCRIPTION_COMMISSION_STATUSES.PENDING,
      })
      .select(COMMISSION_SELECT)
      .single()

    if (commissionError || !commissionRow) {
      return {
        data: null,
        error: mapError(
          commissionError ?? { message: "No se pudo registrar la comisión." }
        ),
      }
    }

    commission = mapSubscriptionCommissionRow(
      commissionRow as SubscriptionCommissionRow
    )
  }

  return { data: { customer, sale, commission }, error: null }
}

export async function transitionSubscriptionCustomer(
  client: SupabaseSubscriptionsClient,
  customerId: string,
  nextStatus: SubscriptionCustomerStatus
): Promise<SubscriptionsRepositoryResult<SubscriptionCustomer>> {
  const { data: existing, error: fetchError } = await (client as SupabaseClient)
    .from("subscription_customers")
    .select(CUSTOMER_SELECT)
    .eq("id", customerId)
    .is("deleted_at", null)
    .maybeSingle()

  if (fetchError) {
    return { data: null, error: mapError(fetchError) }
  }
  if (!existing) {
    return {
      data: null,
      error: { code: "NOT_FOUND", message: "Suscriptor no encontrado." },
    }
  }

  const current = mapSubscriptionCustomerRow(
    existing as SubscriptionCustomerRow
  )
  if (!canTransitionSubscriptionCustomer(current.status, nextStatus)) {
    return {
      data: null,
      error: {
        code: "INVALID_TRANSITION",
        message: `No se puede pasar de ${current.status} a ${nextStatus}.`,
      },
    }
  }

  const { data: updated, error: updateError } = await (client as SupabaseClient)
    .from("subscription_customers")
    .update({ status: nextStatus })
    .eq("id", customerId)
    .is("deleted_at", null)
    .select(CUSTOMER_SELECT)
    .single()

  if (updateError || !updated) {
    return {
      data: null,
      error: mapError(
        updateError ?? { message: "No se pudo actualizar el estado." }
      ),
    }
  }

  if (nextStatus === SUBSCRIPTION_CUSTOMER_STATUSES.ACTIVE) {
    await (client as SupabaseClient)
      .from("subscription_sales")
      .update({ status: SUBSCRIPTION_SALE_STATUSES.COMPLETED })
      .eq("customer_id", customerId)
      .eq("status", SUBSCRIPTION_SALE_STATUSES.OPEN)
      .is("deleted_at", null)
  }

  if (nextStatus === SUBSCRIPTION_CUSTOMER_STATUSES.CANCELLED) {
    await (client as SupabaseClient)
      .from("subscription_sales")
      .update({ status: SUBSCRIPTION_SALE_STATUSES.CANCELLED })
      .eq("customer_id", customerId)
      .eq("status", SUBSCRIPTION_SALE_STATUSES.OPEN)
      .is("deleted_at", null)
  }

  return {
    data: mapSubscriptionCustomerRow(updated as SubscriptionCustomerRow),
    error: null,
  }
}

export async function markSubscriptionCommissionPaid(
  client: SupabaseSubscriptionsClient,
  commissionId: string
): Promise<SubscriptionsRepositoryResult<SubscriptionCommission>> {
  const { data, error } = await (client as SupabaseClient)
    .from("subscription_commissions")
    .update({ status: SUBSCRIPTION_COMMISSION_STATUSES.PAID })
    .eq("id", commissionId)
    .eq("status", SUBSCRIPTION_COMMISSION_STATUSES.PENDING)
    .is("deleted_at", null)
    .select(COMMISSION_SELECT)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapError(error) }
  }
  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Comisión no encontrada o ya pagada.",
      },
    }
  }

  return {
    data: mapSubscriptionCommissionRow(data as SubscriptionCommissionRow),
    error: null,
  }
}

export type { SubscriptionCommissionStatus }
