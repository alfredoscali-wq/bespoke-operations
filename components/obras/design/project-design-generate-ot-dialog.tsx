"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type ProjectDesignGenerateOtDialogProps = {
  open: boolean
  nodeNew: number
  napNew: number
  reused: number
  busy?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function ProjectDesignGenerateOtDialog({
  open,
  nodeNew,
  napNew,
  reused,
  busy = false,
  onOpenChange,
  onConfirm,
}: ProjectDesignGenerateOtDialogProps) {
  const totalNew = nodeNew + napNew
  const noneNew = totalNew === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generar OTs preliminares</DialogTitle>
          <DialogDescription>
            Se crean preliminares de Node y NAP. No se crea ninguna OT real todavía.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
          <li className="flex justify-between gap-2">
            <span>Nodes nuevos</span>
            <span className="tabular-nums font-medium">{nodeNew}</span>
          </li>
          <li className="flex justify-between gap-2">
            <span>NAPs nuevas</span>
            <span className="tabular-nums font-medium">{napNew}</span>
          </li>
        </ul>
        {noneNew ? (
          <p className="text-sm text-muted-foreground">
            Todos los Node y NAP ya tienen una preliminar activa.
            {reused > 0 ? ` (${reused} reutilizada${reused === 1 ? "" : "s"})` : ""}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Las preliminares se revisan en Obra → OTs. No aparecen en Planificación
            ni en Field Agent hasta que se cree la OT y se envíe a cuadrilla.
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={busy || noneNew}
            onClick={onConfirm}
          >
            {busy ? "Generando…" : "Generar preliminares"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
