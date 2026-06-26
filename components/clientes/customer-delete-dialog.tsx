"use client"

import { useEffect, useState } from "react"

import { useCustomers } from "@/components/clientes/customers-provider"
import { checkCustomerCanDelete } from "@/lib/supabase/customers.browser"
import {
  CUSTOMER_DELETE_BLOCKED_MESSAGE,
} from "@/lib/customers/customer-delete"
import { CUSTOMER_EXCLUDE_BLOCKED_MESSAGE } from "@/lib/customers/customer-activity"
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

type CustomerDeleteDialogProps = {
  customer: CustomerListRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (message: string) => void
}

export function CustomerDeleteDialog({
  customer,
  open,
  onOpenChange,
  onSuccess,
}: CustomerDeleteDialogProps) {
  const { deleteCustomer } = useCustomers()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteCheck, setDeleteCheck] = useState<
    { allowed: true } | { allowed: false; message: string }
  >({ allowed: false, message: "" })
  const [isChecking, setIsChecking] = useState(false)

  const isMigrationCustomer = Boolean(customer?.legacyMigrationId)
  const blockedMessage = isMigrationCustomer
    ? CUSTOMER_EXCLUDE_BLOCKED_MESSAGE
    : CUSTOMER_DELETE_BLOCKED_MESSAGE

  useEffect(() => {
    if (!open || !customer) {
      return
    }

    let cancelled = false
    setIsChecking(true)

    void checkCustomerCanDelete(customer.id).then((result) => {
      if (cancelled) return
      setDeleteCheck(result)
      setError(result.allowed ? null : result.message || blockedMessage)
      setIsChecking(false)
    })

    return () => {
      cancelled = true
    }
  }, [open, customer, blockedMessage])

  async function handleDelete() {
    if (!customer || !deleteCheck.allowed) {
      setError(blockedMessage)
      return
    }

    setError(null)
    setIsSubmitting(true)

    try {
      const result = await deleteCustomer(customer.id)

      if (!result.success) {
        setError(result.message ?? "No se pudo excluir al cliente.")
        return
      }

      onSuccess(
        isMigrationCustomer
          ? `Cliente ${customer.name} excluido de la migración.`
          : `Cliente ${customer.name} eliminado definitivamente.`
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
          <DialogTitle>
            {isMigrationCustomer
              ? "Excluir de la migración"
              : "Eliminar cliente"}
          </DialogTitle>
          <DialogDescription className="space-y-2">
            {isChecking ? (
              <span className="block">Verificando actividad operativa...</span>
            ) : deleteCheck.allowed ? (
              <>
                <span className="block">
                  {isMigrationCustomer
                    ? "El cliente se eliminará de Bespoke porque aún no posee actividad operativa."
                    : "Esta acción eliminará definitivamente el cliente."}
                </span>
                <span className="block">
                  No podrá recuperarse posteriormente.
                </span>
                <span className="block">¿Desea continuar?</span>
                {customer ? (
                  <span className="block font-medium text-foreground">
                    {customer.name}
                  </span>
                ) : null}
              </>
            ) : (
              <span className="block text-destructive">{blockedMessage}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {error && deleteCheck.allowed && (
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
          {deleteCheck.allowed && !isChecking && (
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isSubmitting || !customer}
            >
              {isSubmitting
                ? isMigrationCustomer
                  ? "Excluyendo..."
                  : "Eliminando..."
                : isMigrationCustomer
                  ? "Excluir"
                  : "Eliminar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
