/** Centralized treasury category catalogs — single source for UI + validation. */

export const TREASURY_MOVEMENT_TYPES = {
  INCOME: "income",
  EXPENSE: "expense",
} as const

export type TreasuryMovementType =
  (typeof TREASURY_MOVEMENT_TYPES)[keyof typeof TREASURY_MOVEMENT_TYPES]

export const TREASURY_ORIGINS = {
  MANUAL: "manual",
  TASK: "task",
  SALES: "sales",
  CUSTOMER_SERVICE: "customer_service",
  ADMINISTRATION: "administration",
} as const

export type TreasuryOrigin =
  (typeof TREASURY_ORIGINS)[keyof typeof TREASURY_ORIGINS]

export const TREASURY_STATUSES = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
} as const

export type TreasuryStatus =
  (typeof TREASURY_STATUSES)[keyof typeof TREASURY_STATUSES]

export const TREASURY_INCOME_CATEGORIES = [
  "instalacion",
  "reparacion",
  "cobranza",
  "pago_manual",
  "reintegro",
  "otro",
] as const

export const TREASURY_EXPENSE_CATEGORIES = [
  "combustible",
  "materiales",
  "herramientas",
  "adelanto",
  "viaticos",
  "repuestos",
  "otro",
] as const

export type TreasuryIncomeCategory = (typeof TREASURY_INCOME_CATEGORIES)[number]
export type TreasuryExpenseCategory = (typeof TREASURY_EXPENSE_CATEGORIES)[number]
export type TreasuryCategory = TreasuryIncomeCategory | TreasuryExpenseCategory

export const TREASURY_INCOME_CATEGORY_LABELS: Record<
  TreasuryIncomeCategory,
  string
> = {
  instalacion: "Instalación",
  reparacion: "Reparación",
  cobranza: "Cobranza",
  pago_manual: "Pago Manual",
  reintegro: "Reintegro",
  otro: "Otro",
}

export const TREASURY_EXPENSE_CATEGORY_LABELS: Record<
  TreasuryExpenseCategory,
  string
> = {
  combustible: "Combustible",
  materiales: "Materiales",
  herramientas: "Herramientas",
  adelanto: "Adelanto",
  viaticos: "Viáticos",
  repuestos: "Repuestos",
  otro: "Otro",
}

export const TREASURY_ORIGIN_LABELS: Record<TreasuryOrigin, string> = {
  manual: "Registro Manual",
  task: "Órdenes de Trabajo",
  sales: "Ventas",
  customer_service: "Atención al Cliente",
  administration: "Administración",
}

export const TREASURY_STATUS_LABELS: Record<TreasuryStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  cancelled: "Anulado",
}

export const TREASURY_TYPE_LABELS: Record<TreasuryMovementType, string> = {
  income: "Ingreso",
  expense: "Egreso",
}

export function listTreasuryCategoriesForType(
  type: TreasuryMovementType
): Array<{ value: TreasuryCategory; label: string }> {
  if (type === TREASURY_MOVEMENT_TYPES.INCOME) {
    return TREASURY_INCOME_CATEGORIES.map((value) => ({
      value,
      label: TREASURY_INCOME_CATEGORY_LABELS[value],
    }))
  }

  return TREASURY_EXPENSE_CATEGORIES.map((value) => ({
    value,
    label: TREASURY_EXPENSE_CATEGORY_LABELS[value],
  }))
}

export function formatTreasuryCategoryLabel(
  type: TreasuryMovementType,
  category: string
): string {
  if (type === TREASURY_MOVEMENT_TYPES.INCOME) {
    return (
      TREASURY_INCOME_CATEGORY_LABELS[category as TreasuryIncomeCategory] ??
      category
    )
  }
  return (
    TREASURY_EXPENSE_CATEGORY_LABELS[category as TreasuryExpenseCategory] ??
    category
  )
}

export function isTreasuryCategoryForType(
  type: TreasuryMovementType,
  category: string
): boolean {
  if (type === TREASURY_MOVEMENT_TYPES.INCOME) {
    return (TREASURY_INCOME_CATEGORIES as readonly string[]).includes(category)
  }
  return (TREASURY_EXPENSE_CATEGORIES as readonly string[]).includes(category)
}
