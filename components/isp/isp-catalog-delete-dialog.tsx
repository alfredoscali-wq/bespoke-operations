"use client"

import { useState } from "react"

import {
  ISP_CATALOG_DELETE_CONFIRM_BODY,
  ISP_CATALOG_DELETE_CONFIRM_TITLE,
} from "@/lib/isp/catalog-integrity"
import type { IspCatalogItem } from "@/lib/isp/catalog-types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type CatalogDeleteResponse = {
  success: boolean
  deleted?: boolean
  message?: string
}

export function IspCatalogDeleteDialog({
  item,
  open,
  onOpenChange,
  onDeleted,
  onError,
}: {
  item: IspCatalogItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
  onError?: (message: string) => void
}) {
  const [busy, setBusy] = useState(false)

  function close() {
    if (busy) return
    onOpenChange(false)
  }

  async function confirmDelete() {
    setBusy(true)
    try {
      const response = await fetch(`/api/isp/catalog/${item.id}`, {
        method: "DELETE",
      })
      const body = (await response.json()) as CatalogDeleteResponse
      if (!response.ok || !body.success) {
        onError?.(body.message ?? "No se pudo eliminar el servicio.")
        return
      }
      onOpenChange(false)
      onDeleted()
    } catch {
      onError?.("No se pudo eliminar el servicio.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
        else onOpenChange(true)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{ISP_CATALOG_DELETE_CONFIRM_TITLE}</DialogTitle>
          <DialogDescription>
            {ISP_CATALOG_DELETE_CONFIRM_BODY}
          </DialogDescription>
        </DialogHeader>
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
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function IspCatalogDeleteButton({
  item,
  onDeleted,
  onError,
}: {
  item: IspCatalogItem
  onDeleted: () => void
  onUpdated?: (item: IspCatalogItem) => void
  onError?: (message: string) => void
}) {
  const [open, setOpen] = useState(false)

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
      <IspCatalogDeleteDialog
        item={item}
        open={open}
        onOpenChange={setOpen}
        onDeleted={onDeleted}
        onError={onError}
      />
    </>
  )
}
