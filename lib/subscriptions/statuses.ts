export const SUBSCRIPTION_CUSTOMER_STATUSES = {
  PENDING_PAYMENT: "pending_payment",
  PAID: "paid",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  CANCELLED: "cancelled",
} as const

export type SubscriptionCustomerStatus =
  (typeof SUBSCRIPTION_CUSTOMER_STATUSES)[keyof typeof SUBSCRIPTION_CUSTOMER_STATUSES]

export const SUBSCRIPTION_CUSTOMER_STATUS_LABELS: Record<
  SubscriptionCustomerStatus,
  string
> = {
  pending_payment: "Pendiente de Pago",
  paid: "Pagado",
  active: "Activado",
  suspended: "Suspendido",
  cancelled: "Baja",
}

export const SUBSCRIPTION_SALE_STATUSES = {
  OPEN: "open",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const

export type SubscriptionSaleStatus =
  (typeof SUBSCRIPTION_SALE_STATUSES)[keyof typeof SUBSCRIPTION_SALE_STATUSES]

export const SUBSCRIPTION_SALE_STATUS_LABELS: Record<
  SubscriptionSaleStatus,
  string
> = {
  open: "Abierta",
  completed: "Completada",
  cancelled: "Cancelada",
}

export const SUBSCRIPTION_COMMISSION_STATUSES = {
  PENDING: "pending",
  PAID: "paid",
} as const

export type SubscriptionCommissionStatus =
  (typeof SUBSCRIPTION_COMMISSION_STATUSES)[keyof typeof SUBSCRIPTION_COMMISSION_STATUSES]

export const SUBSCRIPTION_COMMISSION_STATUS_LABELS: Record<
  SubscriptionCommissionStatus,
  string
> = {
  pending: "Pendiente",
  paid: "Pagada",
}

/** Allowed transitions for the subscription customer workflow. */
export const SUBSCRIPTION_CUSTOMER_TRANSITIONS: Record<
  SubscriptionCustomerStatus,
  SubscriptionCustomerStatus[]
> = {
  pending_payment: ["paid", "cancelled"],
  paid: ["active", "cancelled"],
  active: ["suspended", "cancelled"],
  suspended: ["active", "cancelled"],
  cancelled: [],
}

export function canTransitionSubscriptionCustomer(
  from: SubscriptionCustomerStatus,
  to: SubscriptionCustomerStatus
): boolean {
  return SUBSCRIPTION_CUSTOMER_TRANSITIONS[from]?.includes(to) ?? false
}
