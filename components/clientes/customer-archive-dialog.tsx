"use client"

import { useState } from "react"

import { useCustomers } from "@/components/clientes/customers-provider"
import type { Customer } from "@/lib/types/customers"
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
  customer: Customer | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (message: string) => void
}

export function CustomerArchiveDialog({
  customer,
  open,
  onOpenChange,
  onSuccess,
}: CustomerArchiveDialogProps) {
  const { updateCustomer } = useCustomers()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleArchive() {
    if (!customer) return

    setError(null)
    setIsSubmitting(true)

    try {
      const result = await updateCustomer(customer.id, {
        deletedAt: new Date().toISOString(),
      })

      if (!result.success) {
        setError(result.message ?? "No se pudo archivar al cliente.")
        return
      }

      onSuccess(`Cliente ${customer.name} archivado correctamente.`)
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
            El cliente dejará de aparecer en operaciones activas. Los datos se
            conservan en archivo lógico.
            {customer ? (
              <>
                {" "}
                <span className="font-medium text-foreground">
                  {customer.name}
                </span>
              </>
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
            disabled={isSubmitting || !customer}
          >
            {isSubmitting ? "Archivando..." : "Archivar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
