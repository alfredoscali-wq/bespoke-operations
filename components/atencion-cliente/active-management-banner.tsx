"use client"

import type { OperatorActiveManagement } from "@/lib/customer-atenciones/consultation-exclusive-management"
import { Button } from "@/components/ui/button"

type ActiveManagementBannerProps = {
  active: OperatorActiveManagement
  onContinue: () => void
  isCancelling?: boolean
  onCancel?: () => void
}

/**
 * RC 3.2.3 — persistent notice while the operator has an en_gestion consultation.
 */
export function ActiveManagementBanner({
  active,
  onContinue,
  isCancelling = false,
  onCancel,
}: ActiveManagementBannerProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-sky-200 bg-sky-50/90 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="min-w-0 space-y-0.5">
        <p className="text-[13px] font-semibold text-sky-950">
          Tenés una gestión en curso.
        </p>
        <p className="truncate text-[12px] text-sky-900/80">
          Cliente:{" "}
          <span className="font-medium text-sky-950">{active.customerName}</span>
          {" · "}
          Consulta:{" "}
          <span className="font-medium text-sky-950">{active.expedienteCode}</span>
          {" · "}
          {active.relativeAge}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {onCancel ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            disabled={isCancelling}
            onClick={onCancel}
          >
            {isCancelling ? "Cancelando…" : "Cancelar gestión"}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          className="h-8"
          disabled={isCancelling}
          onClick={onContinue}
        >
          Continuar gestión
        </Button>
      </div>
    </div>
  )
}
