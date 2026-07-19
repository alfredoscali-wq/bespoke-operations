"use client"

import type { OperatorActiveManagement } from "@/lib/customer-atenciones/consultation-exclusive-management"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type ExclusiveManagementDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  active: OperatorActiveManagement
  isCancelling?: boolean
  onContinue: () => void
  onCancelActive: () => void
}

/**
 * RC 3.2.3 — shown when starting a second management while one is already active.
 */
export function ExclusiveManagementDialog({
  open,
  onOpenChange,
  active,
  isCancelling = false,
  onContinue,
  onCancelActive,
}: ExclusiveManagementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ya tienes una gestión en curso</DialogTitle>
          <DialogDescription>
            Actualmente estás gestionando otra consulta. Antes de comenzar una
            nueva gestión debes finalizarla o cancelarla.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-[13px]">
          <p>
            <span className="text-muted-foreground">Consulta:</span>{" "}
            <span className="font-semibold text-foreground">
              {active.expedienteCode}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">Cliente:</span>{" "}
            <span className="font-semibold text-foreground">
              {active.customerName}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">Tiempo en gestión:</span>{" "}
            <span className="font-semibold text-foreground">
              {active.relativeAge}
            </span>
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={isCancelling}
            onClick={onCancelActive}
          >
            {isCancelling ? "Cancelando…" : "Cancelar gestión actual"}
          </Button>
          <Button
            type="button"
            disabled={isCancelling}
            onClick={onContinue}
          >
            Continuar gestión actual
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
