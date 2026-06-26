"use client"

import { useEffect, useState } from "react"

import { ProjectSupervisorSelect } from "@/components/obras/project-supervisor-select"
import type { NewProjectInput, Project, ProjectType } from "@/lib/types/projects"
import { PROJECT_TYPE_OPTIONS } from "@/lib/projects/constants"
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

type ProjectEditDialogProps = {
  project: Project
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: NewProjectInput) => Promise<void> | void
  isSubmitting?: boolean
}

function projectToForm(project: Project): NewProjectInput {
  return {
    name: project.name,
    code: project.code,
    client: project.client,
    type: project.type,
    location: project.location,
    description: project.description,
    startDate: project.startDate ?? "",
    endDate: project.endDate ?? "",
    supervisor: project.supervisor,
  }
}

export function ProjectEditDialog({
  project,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
}: ProjectEditDialogProps) {
  const [form, setForm] = useState<NewProjectInput>(() => projectToForm(project))
  const [baselineForm, setBaselineForm] = useState<NewProjectInput>(() =>
    projectToForm(project)
  )

  const isDirty = isFormStateDirty(form, baselineForm)
  const {
    handleOpenChange,
    requestClose,
    forceClose,
    discardOpen,
    setDiscardOpen,
    confirmDiscard,
  } = useProtectedFormDialog({ open, onOpenChange, isDirty })

  useEffect(() => {
    if (open) {
      const nextForm = projectToForm(project)
      setForm(nextForm)
      setBaselineForm(nextForm)
    }
  }, [open, project])

  function updateField<K extends keyof NewProjectInput>(
    key: K,
    value: NewProjectInput[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    await onSubmit(form)
    forceClose()
  }

  const isValid =
    form.name.trim() !== "" &&
    form.code.trim() !== "" &&
    form.client.trim() !== "" &&
    form.location.trim() !== "" &&
    form.supervisor.trim() !== ""

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <ProtectedFormDialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
          onRequestClose={requestClose}
          isDirty={isDirty}
        >
        <DialogHeader>
          <DialogTitle>Editar obra</DialogTitle>
          <DialogDescription>
            Actualice los datos operativos y administrativos de la obra.
          </DialogDescription>
        </DialogHeader>

        <form id="edit-project-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-name">Nombre de la obra</Label>
              <Input
                id="edit-name"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-code">Código</Label>
              <Input
                id="edit-code"
                value={form.code}
                onChange={(event) => updateField("code", event.target.value)}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-client">Cliente</Label>
              <Input
                id="edit-client"
                value={form.client}
                onChange={(event) => updateField("client", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-type">Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(value) =>
                  updateField("type", value as ProjectType)
                }
              >
                <SelectTrigger id="edit-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <ProjectSupervisorSelect
              id="edit-supervisor"
              value={form.supervisor}
              onValueChange={(value) => updateField("supervisor", value)}
              showLegacyHint
            />

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-location">Ubicación</Label>
              <Input
                id="edit-location"
                value={form.location}
                onChange={(event) => updateField("location", event.target.value)}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="edit-description">Descripción</Label>
              <Textarea
                id="edit-description"
                value={form.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-startDate">Fecha de inicio</Label>
              <Input
                id="edit-startDate"
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  updateField("startDate", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-endDate">Fecha estimada de fin</Label>
              <Input
                id="edit-endDate"
                type="date"
                value={form.endDate}
                onChange={(event) => updateField("endDate", event.target.value)}
              />
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={requestClose}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="edit-project-form"
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? "Guardando..." : "Guardar cambios"}
          </Button>
        </DialogFooter>
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
