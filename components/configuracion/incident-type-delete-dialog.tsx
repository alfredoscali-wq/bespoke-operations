"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  INCIDENT_TYPE_DELETE_BLOCKED_MESSAGE,
  canDeleteIncidentType,
} from "@/lib/incident-types/incident-type-delete"
import type { IncidentType } from "@/lib/types/incident-types"

type IncidentTypeDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: IncidentType | null
  onConfirm: () => Promise<void>
  getUsageCount: (
    code: string
  ) => Promise<
    | { success: true; count: number }
    | { success: false; message: string }
  >
}

export function IncidentTypeDeleteDialog({
  open,
  onOpenChange,
  record,
  onConfirm,
  getUsageCount,
}: IncidentTypeDeleteDialogProps) {
  const [isChecking, setIsChecking] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canDelete, setCanDelete] = useState(true)

  useEffect(() => {
    if (!open || !record) {
      return
    }

    let cancelled = false

    async function checkUsage() {
      setIsChecking(true)
      setError(null)

      const result = await getUsageCount(record!.code)

      if (cancelled) {
        return
      }

      if (!result.success) {
        setError(result.message)
        setCanDelete(false)
      } else {
        const validation = canDeleteIncidentType(record!.code, result.count)
        setCanDelete(validation.allowed)
        if (!validation.allowed) {
          setError(validation.message)
        }
      }

      setIsChecking(false)
    }

    void checkUsage()

    return () => {
      cancelled = true
    }
  }, [getUsageCount, open, record])

  async function handleConfirm() {
    if (!record || !canDelete) {
      return
    }

    setIsDeleting(true)
    setError(null)

    try {
      await onConfirm()
      onOpenChange(false)
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el tipo de incidencia."
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar tipo de incidencia</DialogTitle>
          <DialogDescription>
            {record
              ? `¿Confirma la eliminación de "${record.name}"?`
              : "Confirme la eliminación del tipo de incidencia."}
          </DialogDescription>
        </DialogHeader>

        {isChecking ? (
          <p className="text-sm text-muted-foreground">
            Verificando uso del tipo de incidencia...
          </p>
        ) : null}

        {!isChecking && !canDelete ? (
          <p className="text-sm text-muted-foreground">
            {error ?? INCIDENT_TYPE_DELETE_BLOCKED_MESSAGE}
          </p>
        ) : null}

        {error && canDelete ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={isChecking || isDeleting || !canDelete}
          >
            {isDeleting ? "Eliminando..." : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
