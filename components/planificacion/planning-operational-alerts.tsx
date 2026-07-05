"use client"

import { cn } from "@/lib/utils"

type PlanningOperationalAlertsProps = {
  pendingApprovalCount: number
  onOpenPendingApproval: () => void
  className?: string
}

export function PlanningOperationalAlerts({
  pendingApprovalCount,
  onOpenPendingApproval,
  className,
}: PlanningOperationalAlertsProps) {
  if (pendingApprovalCount <= 0) {
    return null
  }

  const label =
    pendingApprovalCount === 1
      ? "1 Orden pendiente de aprobación"
      : `${pendingApprovalCount} Órdenes pendientes de aprobación`

  return (
    <section className={cn("w-full", className)}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Alertas operativas
      </p>
      <button
        type="button"
        onClick={onOpenPendingApproval}
        className="flex w-full items-center gap-3 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-left text-sm font-semibold text-orange-950 transition hover:border-orange-400 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-100 dark:hover:bg-orange-950/60"
      >
        <span aria-hidden className="text-base">
          ⚠
        </span>
        <span>{label}</span>
      </button>
    </section>
  )
}
