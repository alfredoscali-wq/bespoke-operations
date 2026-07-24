import type { TreasuryMovementUpdate } from "@/lib/supabase/database.types"
import type {
  CreateTreasuryMovementInput,
  TreasuryMovement,
  UpdateTreasuryMovementInput,
} from "@/lib/types/tesoreria"
import type {
  TreasuryMovementType,
  TreasuryOrigin,
  TreasuryStatus,
} from "@/lib/tesoreria/categories"

type EmployeeNameJoin = {
  id: string
  first_name: string
  last_name: string
  preferred_name: string | null
} | null

export type TreasuryMovementRow = {
  id: string
  company_id: string
  movement_type: string
  origin: string
  category: string
  amount: number | string
  movement_date: string
  employee_id: string | null
  registered_by: string | null
  status: string
  notes: string
  receipt_url: string | null
  cashbox_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  employee?: EmployeeNameJoin
  registered_by_employee?: EmployeeNameJoin
}

function formatEmployeeName(row: EmployeeNameJoin): string | null {
  if (!row) return null
  const preferred = row.preferred_name?.trim()
  if (preferred) return preferred
  return `${row.first_name} ${row.last_name}`.trim() || row.id
}

export function mapTreasuryMovementRow(
  row: TreasuryMovementRow
): TreasuryMovement {
  return {
    id: row.id,
    companyId: row.company_id,
    movementType: row.movement_type as TreasuryMovementType,
    origin: row.origin as TreasuryOrigin,
    category: row.category,
    amount: Number(row.amount),
    movementDate: row.movement_date,
    employeeId: row.employee_id,
    employeeName: formatEmployeeName(row.employee ?? null),
    registeredBy: row.registered_by,
    registeredByName: formatEmployeeName(row.registered_by_employee ?? null),
    status: row.status as TreasuryStatus,
    notes: row.notes ?? "",
    receiptUrl: row.receipt_url,
    cashboxId: row.cashbox_id,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata
        : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

export function mapCreateTreasuryMovementInput(
  input: CreateTreasuryMovementInput
) {
  return {
    company_id: input.companyId,
    movement_type: input.movementType,
    origin: input.origin,
    category: input.category,
    amount: input.amount,
    movement_date: input.movementDate,
    employee_id: input.employeeId ?? null,
    registered_by: input.registeredBy ?? null,
    status: input.status ?? "confirmed",
    notes: input.notes?.trim() ?? "",
    receipt_url: input.receiptUrl ?? null,
  }
}

export function mapUpdateTreasuryMovementInput(
  input: UpdateTreasuryMovementInput
): TreasuryMovementUpdate {
  const update: TreasuryMovementUpdate = {}
  if (input.origin !== undefined) update.origin = input.origin
  if (input.category !== undefined) update.category = input.category
  if (input.amount !== undefined) update.amount = input.amount
  if (input.movementDate !== undefined) update.movement_date = input.movementDate
  if (input.employeeId !== undefined) update.employee_id = input.employeeId
  if (input.status !== undefined) update.status = input.status
  if (input.notes !== undefined) update.notes = input.notes.trim()
  if (input.receiptUrl !== undefined) update.receipt_url = input.receiptUrl
  return update
}
