"use client"

import type { LockedConsultationInfo } from "@/lib/customer-atenciones/consultation-management-lock"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type LockedConsultationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  lock: LockedConsultationInfo
}

/**
 * RC 3.2.5 — shown when another operator already holds the exclusive lock.
 */
export function LockedConsultationDialog({
  open,
  onOpenChange,
  lock,
}: LockedConsultationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Consulta en gestión</DialogTitle>
          <DialogDescription>
            Esta consulta ya está siendo gestionada por otro operador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-[13px]">
          <p>
            <span className="text-muted-foreground">Operador:</span>{" "}
            <span className="font-semibold text-foreground">
              {lock.managerName}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">Inicio de la gestión:</span>{" "}
            <span className="font-semibold text-foreground">
              {lock.startedAtLabel}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">Tiempo transcurrido:</span>{" "}
            <span className="font-semibold text-foreground">
              {lock.relativeAge}
            </span>
          </p>
        </div>

        <p className="text-[13px] leading-snug text-muted-foreground">
          Para evitar conflictos solo un operador puede gestionar una consulta
          al mismo tiempo.
        </p>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Aceptar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
