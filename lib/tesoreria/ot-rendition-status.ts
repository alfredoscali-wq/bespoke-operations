export const TREASURY_OT_RENDITION_STATUSES = {
  PENDING: "pendiente_rendicion",
  RENDERED: "rendida",
  CANCELLED: "cancelled",
} as const

export type TreasuryOtRenditionStatus =
  (typeof TREASURY_OT_RENDITION_STATUSES)[keyof typeof TREASURY_OT_RENDITION_STATUSES]

export const TREASURY_OT_RENDITION_STATUS_LABELS: Record<
  TreasuryOtRenditionStatus,
  string
> = {
  pendiente_rendicion: "Pendiente de rendición",
  rendida: "Rendida",
  cancelled: "Anulada",
}

export function isPendingOtRendition(
  status: TreasuryOtRenditionStatus | string
): boolean {
  return status === TREASURY_OT_RENDITION_STATUSES.PENDING
}
