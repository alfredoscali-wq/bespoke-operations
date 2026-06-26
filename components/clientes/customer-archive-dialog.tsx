"use client"

import { useState } from "react"

import { useCustomers } from "@/components/clientes/customers-provider"
import type { CustomerListRow } from "@/lib/types/customers"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type CustomerArchiveDialogProps = {
  customer: CustomerListRow | null
  customers?: CustomerListRow[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (message: string) => void
}

export function CustomerArchiveDialog({
  customer,
  customers,
  open,
  onOpenChange,
  onSuccess,
}: CustomerArchiveDialogProps) {
  const { updateCustomer } = useCustomers()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const targets = customers && customers.length > 0 ? customers : customer ? [customer] : []

  async function handleArchive() {
    if (targets.length === 0) return

    setError(null)
    setIsSubmitting(true)

    try {
      for (const target of targets) {
        const result = await updateCustomer(target.id, {
          deletedAt: new Date().toISOString(),
        })

        if (!result.success) {
          setError(result.message ?? "No se pudo archivar al cliente.")
          return
        }
      }

      onSuccess(
        targets.length === 1
          ? `Cliente ${targets[0].name} archivado correctamente.`
          : `${targets.length} clientes archivados correctamente.`
      )
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setError(null)
        }
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Archivar cliente</DialogTitle>
          <DialogDescription>
            El cliente dejará de aparecer en operaciones activas. El historial,
            órdenes de trabajo, evidencias y materiales se conservan.
            {targets.length === 1 ? (
              <>
                {" "}
                <span className="font-medium text-foreground">
                  {targets[0].name}
                </span>
              </>
            ) : targets.length > 1 ? (
              <> Se archivarán {targets.length} clientes.</>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleArchive}
            disabled={isSubmitting || targets.length === 0}
          >
            {isSubmitting ? "Archivando..." : "Archivar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
