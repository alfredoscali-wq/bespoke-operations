import {
  SUBSCRIPTION_CUSTOMER_STATUSES,
} from "@/lib/subscriptions/statuses"
import type {
  SubscriptionCustomer,
  SubscriptionDashboardSummary,
  SubscriptionSale,
} from "@/lib/types/subscriptions"

function toDayKeyFromDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function startOfLocalMonth(reference = new Date()): Date {
  return new Date(reference.getFullYear(), reference.getMonth(), 1)
}

export function summarizeSubscriptions(
  customers: ReadonlyArray<
    Pick<SubscriptionCustomer, "status" | "serviceId" | "createdAt">
  >,
  services: ReadonlyArray<{ id: string; monthlyPrice: number }>,
  reference = new Date()
): SubscriptionDashboardSummary {
  const priceByService = new Map(
    services.map((service) => [service.id, service.monthlyPrice])
  )
  const monthStartKey = toDayKeyFromDate(startOfLocalMonth(reference))

  let activeSubscribers = 0
  let pendingPayment = 0
  let pendingActivation = 0
  let signupsThisMonth = 0
  let expectedBilling = 0

  for (const customer of customers) {
    if (customer.status === SUBSCRIPTION_CUSTOMER_STATUSES.ACTIVE) {
      activeSubscribers += 1
      expectedBilling += priceByService.get(customer.serviceId) ?? 0
    } else if (
      customer.status === SUBSCRIPTION_CUSTOMER_STATUSES.PENDING_PAYMENT
    ) {
      pendingPayment += 1
    } else if (customer.status === SUBSCRIPTION_CUSTOMER_STATUSES.PAID) {
      pendingActivation += 1
    }

    if (customer.createdAt.slice(0, 10) >= monthStartKey) {
      signupsThisMonth += 1
    }
  }

  return {
    activeSubscribers,
    pendingPayment,
    pendingActivation,
    signupsThisMonth,
    expectedBilling,
  }
}

export function listPreAltaCustomers(
  customers: ReadonlyArray<SubscriptionCustomer>
): SubscriptionCustomer[] {
  return customers.filter(
    (customer) =>
      customer.status === SUBSCRIPTION_CUSTOMER_STATUSES.PENDING_PAYMENT ||
      customer.status === SUBSCRIPTION_CUSTOMER_STATUSES.PAID
  )
}

export function listActiveOrManagedSubscribers(
  customers: ReadonlyArray<SubscriptionCustomer>
): SubscriptionCustomer[] {
  return customers.filter(
    (customer) =>
      customer.status === SUBSCRIPTION_CUSTOMER_STATUSES.ACTIVE ||
      customer.status === SUBSCRIPTION_CUSTOMER_STATUSES.SUSPENDED ||
      customer.status === SUBSCRIPTION_CUSTOMER_STATUSES.CANCELLED
  )
}

export function sortSalesNewestFirst(
  sales: ReadonlyArray<SubscriptionSale>
): SubscriptionSale[] {
  return [...sales].sort((a, b) => {
    if (a.saleDate === b.saleDate) {
      return b.createdAt.localeCompare(a.createdAt)
    }
    return b.saleDate.localeCompare(a.saleDate)
  })
}
