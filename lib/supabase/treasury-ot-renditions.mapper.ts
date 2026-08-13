import type { TreasuryOtRendition } from "@/lib/types/treasury-ot-renditions"
import type { TreasuryOtRenditionStatus } from "@/lib/tesoreria/ot-rendition-status"

export type TreasuryOtRenditionRow = {
  id: string
  company_id: string
  task_id: string
  task_code: string
  customer_id: string | null
  customer_name: string
  amount: number | string
  collection_date: string
  crew_id: string | null
  crew_name: string
  technician_id: string | null
  technician_name: string
  ot_finalized_at: string
  status: TreasuryOtRenditionStatus
  delivered_by: string
  notes: string
  treasury_movement_id: string | null
  confirmed_by: string | null
  confirmed_by_name: string
  confirmed_at: string | null
  payment_method_expected: string | null
  payment_method_received: string | null
  created_at: string
  updated_at: string
}

function toAmount(value: number | string): number {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

export function mapTreasuryOtRenditionRow(
  row: TreasuryOtRenditionRow
): TreasuryOtRendition {
  return {
    id: row.id,
    companyId: row.company_id,
    taskId: row.task_id,
    taskCode: row.task_code ?? "",
    customerId: row.customer_id,
    customerName: row.customer_name ?? "",
    amount: toAmount(row.amount),
    collectionDate: row.collection_date,
    crewId: row.crew_id,
    crewName: row.crew_name ?? "",
    technicianId: row.technician_id,
    technicianName: row.technician_name ?? "",
    otFinalizedAt: row.ot_finalized_at,
    status: row.status,
    deliveredBy: row.delivered_by ?? "",
    notes: row.notes ?? "",
    treasuryMovementId: row.treasury_movement_id,
    confirmedBy: row.confirmed_by,
    confirmedByName: row.confirmed_by_name ?? "",
    confirmedAt: row.confirmed_at,
    paymentMethodExpected: row.payment_method_expected?.trim() || null,
    paymentMethodReceived: row.payment_method_received?.trim() || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
