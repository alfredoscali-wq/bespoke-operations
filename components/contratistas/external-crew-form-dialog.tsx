"use client"

import { useState } from "react"

import type { Crew, NewExternalCrewInput } from "@/lib/types/crews"
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

type ExternalCrewFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  contractorId: string
  defaultSupervisor?: string
  crew?: Crew
  onSubmit: (input: NewExternalCrewInput) => Promise<void>
}

type FormState = {
  name: string
  description: string
  supervisor: string
  notes: string
}

function buildFormState(
  crew: Crew | undefined,
  defaultSupervisor: string
): FormState {
  return {
    name: crew?.name ?? "",
    description: crew?.description ?? "",
    supervisor: crew?.supervisor ?? defaultSupervisor,
    notes: crew?.notes ?? "",
  }
}

export function ExternalCrewFormDialog(props: ExternalCrewFormDialogProps) {
  if (!props.open) {
    return <Dialog open={false} onOpenChange={props.onOpenChange} />
  }

  return (
    <ExternalCrewFormDialogBody
      key={props.crew?.id ?? `create-${props.contractorId}`}
      {...props}
    />
  )
}

function ExternalCrewFormDialogBody({
  open,
  onOpenChange,
  contractorId,
  defaultSupervisor = "",
  crew,
  onSubmit,
}: ExternalCrewFormDialogProps) {
  const initial = buildFormState(crew, defaultSupervisor)
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
    if (!form.name.trim()) {
      setError("El nombre de la cuadrilla es obligatorio.")
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        name: form.name.trim(),
        description: form.description.trim(),
        supervisor: form.supervisor.trim(),
        notes: form.notes.trim(),
        contractorId,
      })
      forceClose()
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar la cuadrilla."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <ProtectedFormDialogContent
          className="max-w-md"
          onRequestClose={requestClose}
          isDirty={isDirty}
        >
          <DialogHeader>
            <DialogTitle>
              {crew ? "Editar cuadrilla externa" : "Nueva cuadrilla externa"}
            </DialogTitle>
            <DialogDescription>
              Se registra como cuadrilla operativa (`crews`) con origen externo.
              Field Agent y planificación usan el mismo flujo.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="ext-crew-name">Nombre *</Label>
              <Input
                id="ext-crew-name"
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ext-crew-supervisor">
                Responsable / supervisor
              </Label>
              <Input
                id="ext-crew-supervisor"
                value={form.supervisor}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    supervisor: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ext-crew-description">Descripción</Label>
              <Textarea
                id="ext-crew-description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ext-crew-notes">Notas</Label>
              <Textarea
                id="ext-crew-notes"
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                rows={2}
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
