"use client"

import { cn } from "@/lib/utils"

type PlanningOperationalAlertsProps = {
  pendingApprovalCount: number
  onOpenPendingApproval: () => void
  activeIncidentsCount: number
  onOpenIncidents: () => void
  className?: string
}

export function PlanningOperationalAlerts({
  pendingApprovalCount,
  onOpenPendingApproval,
  activeIncidentsCount,
  onOpenIncidents,
  className,
}: PlanningOperationalAlertsProps) {
  if (pendingApprovalCount <= 0 && activeIncidentsCount <= 0) {
    return null
  }

  const pendingApprovalLabel =
    pendingApprovalCount === 1
      ? "1 Orden pendiente de aprobación"
      : `${pendingApprovalCount} Órdenes pendientes de aprobación`

  const incidentsLabel =
    activeIncidentsCount === 1
      ? "1 Incidencia activa"
      : `${activeIncidentsCount} Incidencias activas`

  return (
    <section className={cn("w-full space-y-2", className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Alertas operativas
      </p>

      {activeIncidentsCount > 0 ? (
        <button
          type="button"
          onClick={onOpenIncidents}
          className="flex w-full items-center gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-left text-sm font-semibold text-red-950 transition hover:border-red-400 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-950/60"
        >
          <span aria-hidden className="text-base">
            ⚠
          </span>
          <span>{incidentsLabel}</span>
        </button>
      ) : null}

      {pendingApprovalCount > 0 ? (
        <button
          type="button"
          onClick={onOpenPendingApproval}
          className="flex w-full items-center gap-3 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-left text-sm font-semibold text-orange-950 transition hover:border-orange-400 hover:bg-orange-100 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-100 dark:hover:bg-orange-950/60"
        >
          <span aria-hidden className="text-base">
            ⚠
          </span>
          <span>{pendingApprovalLabel}</span>
        </button>
      ) : null}
    </section>
  )
}
