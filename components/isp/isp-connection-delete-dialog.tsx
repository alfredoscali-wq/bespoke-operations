"use client"

import { useState } from "react"

import {
  ISP_CONNECTION_DELETE_BODY,
  ISP_CONNECTION_DELETE_CONFIRM_LABEL,
  ISP_CONNECTION_DELETE_TITLE,
} from "@/lib/isp/connection-delete"
import { formatIspTechnologyLabel } from "@/lib/isp/labels"
import type { IspTechnology } from "@/lib/isp/constants"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type IspConnectionDeleteTarget = {
  id: string
  customerName: string
  planName: string
  technology: IspTechnology | null
}

export function IspConnectionDeleteButton({
  target,
  onDeleted,
  onError,
}: {
  target: IspConnectionDeleteTarget
  onDeleted: () => void
  onError?: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  function close() {
    if (busy) return
    setOpen(false)
  }

  async function confirmDelete() {
    setBusy(true)
    try {
      const response = await fetch(`/api/isp/connections/${target.id}`, {
        method: "DELETE",
      })
      const body = (await response.json()) as {
        success: boolean
        message?: string
      }
      if (!response.ok || !body.success) {
        onError?.(body.message ?? "No se pudo eliminar la conexión.")
        return
      }
      setOpen(false)
      onDeleted()
    } catch {
      onError?.("No se pudo eliminar la conexión.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
      >
        Eliminar
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) close()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{ISP_CONNECTION_DELETE_TITLE}</DialogTitle>
            <DialogDescription>{ISP_CONNECTION_DELETE_BODY}</DialogDescription>
          </DialogHeader>
          <dl className="grid gap-1 text-sm">
            <div>
              <dt className="text-muted-foreground">Cliente</dt>
              <dd className="font-medium">{target.customerName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Servicio</dt>
              <dd>{target.planName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tecnología</dt>
              <dd>{formatIspTechnologyLabel(target.technology)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Plan</dt>
              <dd>{target.planName}</dd>
            </div>
          </dl>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={close}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={() => void confirmDelete()}
            >
              {ISP_CONNECTION_DELETE_CONFIRM_LABEL}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
