import {
  isPendingOtRendition,
  TREASURY_OT_RENDITION_STATUSES,
} from "@/lib/tesoreria/ot-rendition-status"
import type {
  OtRenditionKpi,
  TreasuryOtRendition,
} from "@/lib/types/treasury-ot-renditions"
import type { Task } from "@/lib/types/tasks"

/** OT cobrable finalizada → debe generar pendiente de rendición (no ingreso). */
export function shouldCreateOtCashRendition(
  task: Pick<Task, "status" | "amountToCollect">
): boolean {
  if (task.status !== "finalizada") return false
  const amount = task.amountToCollect
  return typeof amount === "number" && Number.isFinite(amount) && amount > 0
}

export function buildOtRenditionKpi(
  renditions: ReadonlyArray<Pick<TreasuryOtRendition, "status" | "amount">>
): OtRenditionKpi {
  let count = 0
  let totalAmount = 0
  for (const item of renditions) {
    if (!isPendingOtRendition(item.status)) continue
    count += 1
    totalAmount += item.amount
  }
  return { count, totalAmount }
}

export function listPendingOtRenditions<T extends Pick<TreasuryOtRendition, "status">>(
  renditions: ReadonlyArray<T>
): T[] {
  return renditions.filter((item) => isPendingOtRendition(item.status))
}

export function formatOtRenditionKpiCount(count: number): string {
  return `${count} OT`
}

/** Income category used when confirming a rendition. */
export const OT_RENDITION_INCOME_CATEGORY = "cobranza" as const

export { TREASURY_OT_RENDITION_STATUSES }
