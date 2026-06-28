"use client"

import { useEffect, useMemo, useState } from "react"

import type {
  CustomerSyncFieldChange,
  CustomerSyncFieldKey,
} from "@/lib/tasks/customer-sync"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type WorkOrderCustomerSyncDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerName: string
  changes: CustomerSyncFieldChange[]
  onConfirm: (selectedKeys: CustomerSyncFieldKey[]) => Promise<void>
  onSkip: () => void
}

export function WorkOrderCustomerSyncDialog({
  open,
  onOpenChange,
  customerName,
  changes,
  onConfirm,
  onSkip,
}: WorkOrderCustomerSyncDialogProps) {
  const [selectedKeys, setSelectedKeys] = useState<CustomerSyncFieldKey[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSelectedKeys(changes.map((change) => change.key))
      setError(null)
    }
  }, [open, changes])

  const allSelected = useMemo(
    () =>
      changes.length > 0 &&
      changes.every((change) => selectedKeys.includes(change.key)),
    [changes, selectedKeys]
  )

  function toggleKey(key: CustomerSyncFieldKey, checked: boolean) {
    setSelectedKeys((current) =>
      checked ? [...new Set([...current, key])] : current.filter((item) => item !== key)
    )
  }

  async function handleConfirm() {
    if (selectedKeys.length === 0) {
      setError("Seleccione al menos un campo para actualizar la ficha del cliente.")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onConfirm(selectedKeys)
      onOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo actualizar la ficha del cliente."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Actualizar ficha del cliente</DialogTitle>
          <DialogDescription>
            La orden de trabajo modificó datos de contacto respecto a la ficha de{" "}
            <span className="font-medium text-foreground">{customerName}</span>.
            Seleccione qué campos desea sincronizar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {changes.map((change) => {
            const checked = selectedKeys.includes(change.key)

            return (
              <label
                key={change.key}
                className="flex cursor-pointer items-start gap-3 rounded-lg border bg-muted/20 p-3"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) =>
                    toggleKey(change.key, value === true)
                  }
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {change.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ficha: {change.before || "—"}
                  </p>
                  <p className="text-xs font-medium text-foreground">
                    Orden de trabajo: {change.after}
                  </p>
                </div>
              </label>
            )
          })}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onSkip()
              onOpenChange(false)
            }}
            disabled={isSubmitting}
          >
            Mantener ficha actual
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setSelectedKeys(
                  allSelected ? [] : changes.map((change) => change.key)
                )
              }
              disabled={isSubmitting}
            >
              {allSelected ? "Deseleccionar todo" : "Seleccionar todo"}
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Actualizando..." : "Actualizar cliente"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
