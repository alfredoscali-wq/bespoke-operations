"use client"

import { useState } from "react"

import { CONTRACTOR_STATUS_LABELS } from "@/lib/contractors/constants"
import type {
  Contractor,
  ContractorStatus,
  NewContractorInput,
} from "@/lib/types/contractors"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DiscardChangesDialog,
  ProtectedFormDialogContent,
  isFormStateDirty,
  useProtectedFormDialog,
} from "@/components/ui/protected-form-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type ContractorFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  contractor?: Contractor
  onSubmit: (input: NewContractorInput) => Promise<void>
}

type FormState = {
  legalName: string
  tradeName: string
  taxId: string
  responsibleName: string
  phone: string
  email: string
  status: ContractorStatus
  notes: string
}

function buildFormState(contractor?: Contractor): FormState {
  if (!contractor) {
    return {
      legalName: "",
      tradeName: "",
      taxId: "",
      responsibleName: "",
      phone: "",
      email: "",
      status: "activo",
      notes: "",
    }
  }

  return {
    legalName: contractor.legalName,
    tradeName: contractor.tradeName,
    taxId: contractor.taxId,
    responsibleName: contractor.responsibleName,
    phone: contractor.phone,
    email: contractor.email,
    status: contractor.status,
    notes: contractor.notes,
  }
}

export function ContractorFormDialog(props: ContractorFormDialogProps) {
  if (!props.open) {
    return <Dialog open={false} onOpenChange={props.onOpenChange} />
  }

  return (
    <ContractorFormDialogBody
      key={props.contractor?.id ?? "create"}
      {...props}
    />
  )
}

function ContractorFormDialogBody({
  open,
  onOpenChange,
  mode,
  contractor,
  onSubmit,
}: ContractorFormDialogProps) {
  const initial = buildFormState(contractor)
  const [form, setForm] = useState<FormState>(initial)
  const [baselineForm] = useState<FormState>(initial)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDirty = isFormStateDirty(form, baselineForm)
  const {
    handleOpenChange,
    requestClose,
    forceClose,
    discardOpen,
    setDiscardOpen,
    confirmDiscard,
  } = useProtectedFormDialog({ open, onOpenChange, isDirty })

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!form.legalName.trim()) {
      setError("La razón social es obligatoria.")
      return
    }
    if (!form.taxId.trim()) {
      setError("El CUIT es obligatorio.")
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        legalName: form.legalName.trim(),
        tradeName: form.tradeName.trim(),
        taxId: form.taxId.trim(),
        responsibleName: form.responsibleName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        status: form.status,
        notes: form.notes.trim(),
      })
      forceClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar el contratista."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <ProtectedFormDialogContent
          className="max-w-lg"
          onRequestClose={requestClose}
          isDirty={isDirty}
        >
          <DialogHeader>
            <DialogTitle>
              {mode === "create" ? "Nuevo contratista" : "Editar contratista"}
            </DialogTitle>
            <DialogDescription>
              Datos administrativos de la empresa contratista. La ejecución de
              OTs usa el mismo Field Agent que las cuadrillas internas.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="contractor-legal-name">Razón social *</Label>
              <Input
                id="contractor-legal-name"
                value={form.legalName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    legalName: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contractor-trade-name">Nombre comercial</Label>
              <Input
                id="contractor-trade-name"
                value={form.tradeName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    tradeName: event.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contractor-tax-id">CUIT *</Label>
                <Input
                  id="contractor-tax-id"
                  value={form.taxId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      taxId: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contractor-status">Estado</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      status: value as ContractorStatus,
                    }))
                  }
                >
                  <SelectTrigger id="contractor-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(CONTRACTOR_STATUS_LABELS) as ContractorStatus[]
                    ).map((status) => (
                      <SelectItem key={status} value={status}>
                        {CONTRACTOR_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contractor-responsible">Responsable</Label>
              <Input
                id="contractor-responsible"
                value={form.responsibleName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    responsibleName: event.target.value,
                  }))
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contractor-phone">Teléfono</Label>
                <Input
                  id="contractor-phone"
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contractor-email">Email</Label>
                <Input
                  id="contractor-email"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contractor-notes">Observaciones</Label>
              <Textarea
                id="contractor-notes"
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                rows={3}
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={requestClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </ProtectedFormDialogContent>
      </Dialog>

      <DiscardChangesDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onConfirm={confirmDiscard}
      />
    </>
  )
}
