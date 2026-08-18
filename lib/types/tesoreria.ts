import type {
  TreasuryMovementType,
  TreasuryOrigin,
  TreasuryStatus,
} from "@/lib/tesoreria/categories"

export type TreasuryMovement = {
  id: string
  companyId: string
  movementType: TreasuryMovementType
  origin: TreasuryOrigin
  category: string
  amount: number
  movementDate: string
  employeeId: string | null
  employeeName: string | null
  registeredBy: string | null
  registeredByName: string | null
  status: TreasuryStatus
  notes: string
  receiptUrl: string | null
  cashboxId: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type CreateTreasuryMovementInput = {
  companyId: string
  movementType: TreasuryMovementType
  origin: TreasuryOrigin
  category: string
  amount: number
  movementDate: string
  employeeId?: string | null
  registeredBy?: string | null
  status?: TreasuryStatus
  notes?: string
  receiptUrl?: string | null
  metadata?: Record<string, unknown>
}

export type UpdateTreasuryMovementInput = {
  origin?: TreasuryOrigin
  category?: string
  amount?: number
  movementDate?: string
  employeeId?: string | null
  status?: TreasuryStatus
  notes?: string
  receiptUrl?: string | null
}

export type TreasuryDashboardSummary = {
  /** Confirmed net of the selected period: ingresos − egresos − retiros. */
  currentBalance: number
  /** Confirmed incomes in the selected period. */
  income: number
  /** Confirmed operational expenses in the selected period. */
  expense: number
  /** Confirmed withdrawals in the selected period. */
  withdrawalPeriod: number
  pendingRendition: number
}

export type TreasuryHistoryRange = "today" | "week" | "month" | "all"
