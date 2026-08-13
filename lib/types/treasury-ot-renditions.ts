import type { TreasuryOtRenditionStatus } from "@/lib/tesoreria/ot-rendition-status"

export type { TreasuryOtRenditionStatus }

export type TreasuryOtRendition = {
  id: string
  companyId: string
  taskId: string
  taskCode: string
  customerId: string | null
  customerName: string
  amount: number
  collectionDate: string
  crewId: string | null
  crewName: string
  technicianId: string | null
  technicianName: string
  otFinalizedAt: string
  status: TreasuryOtRenditionStatus
  deliveredBy: string
  notes: string
  treasuryMovementId: string | null
  confirmedBy: string | null
  confirmedByName: string
  confirmedAt: string | null
  /** Snapshot of tasks.payment_method — never written back to the OT. */
  paymentMethodExpected: string | null
  paymentMethodReceived: string | null
  createdAt: string
  updatedAt: string
}

export type ConfirmOtRenditionInput = {
  amountReceived: number
  deliveredBy?: string
  notes?: string
  paymentMethodReceived: string
}

export type OtRenditionKpi = {
  count: number
  totalAmount: number
}
