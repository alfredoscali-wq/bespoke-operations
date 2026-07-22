"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { requestHardDeleteContractor } from "@/lib/contractors/hard-delete-contractor.client"
import { CONTRACTOR_PERMANENT_DELETE_CONFIRM_TEXT } from "@/lib/contractors/permanent-delete-policy"

type ContractorPermanentDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contractorId: string
  contractorLabel: string
  onSuccess: (message: string) => void
}

export function ContractorPermanentDeleteDialog({
  open,
  onOpenChange,
  contractorId,
  contractorLabel,
  onSuccess,
}: ContractorPermanentDeleteDialogProps) {
  const [confirmation, setConfirmation] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSubmit =
    confirmation === CONTRACTOR_PERMANENT_DELETE_CONFIRM_TEXT && !isSubmitting

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setConfirmation("")
      setError(null)
    }
    onOpenChange(nextOpen)
  }

  async function handleConfirm() {
    if (!canSubmit) return

    setError(null)
    setIsSubmitting(true)
    try {
      const result = await requestHardDeleteContractor(contractorId)
      if (!result.success) {
        setError(result.error)
        return
      }

      onSuccess(
        `Contratista ${result.legalName || contractorLabel} eliminado definitivamente.`
      )
      handleOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eliminar definitivamente</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p className="font-medium text-destructive">
                Esta acción es irreversible.
              </p>
              <p>
                Se eliminará el contratista, sus cuadrillas externas, sus
                usuarios, sus accesos en Auth y las relaciones asociadas.
              </p>
              <p>
                Contratista:{" "}
                <span className="font-medium text-foreground">
                  {contractorLabel}
                </span>
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="contractor-permanent-delete-confirm">
            Escriba {CONTRACTOR_PERMANENT_DELETE_CONFIRM_TEXT} para confirmar
          </Label>
          <Input
            id="contractor-permanent-delete-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={CONTRACTOR_PERMANENT_DELETE_CONFIRM_TEXT}
            autoComplete="off"
            disabled={isSubmitting}
          />
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={!canSubmit}
          >
            {isSubmitting ? "Eliminando…" : "Eliminar definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
