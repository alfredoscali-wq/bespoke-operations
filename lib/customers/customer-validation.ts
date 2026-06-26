import type { CustomerValidationStatus } from "@/lib/types/customers"
import { cn } from "@/lib/utils"

export const VALIDATION_STATUS_LABELS: Record<CustomerValidationStatus, string> = {
  active: "Activo",
  review: "Revisar",
}

export function formatValidationStatusLabel(
  status: CustomerValidationStatus
): string {
  return VALIDATION_STATUS_LABELS[status]
}

export function validationStatusBadgeClassName(
  status: CustomerValidationStatus
): string {
  return cn(
    "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
    status === "active" &&
      "border-emerald-200/80 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
    status === "review" &&
      "border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
  )
}

export function validationStatusDotClassName(
  status: CustomerValidationStatus
): string {
  return cn(
    "size-1.5 rounded-full",
    status === "active" ? "bg-emerald-500" : "bg-amber-500"
  )
}
