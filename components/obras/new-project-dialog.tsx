"use client"

import { useEffect, useState } from "react"
import { Plus } from "lucide-react"

import { ProjectSupervisorSelect } from "@/components/obras/project-supervisor-select"
import { SharedLocationInput } from "@/components/tareas/shared-location-input"
import type { NewProjectInput, Project, ProjectType } from "@/lib/types/projects"
import { PROJECT_TYPE_OPTIONS } from "@/lib/projects/constants"
import { enrichProjectInputWithResolvedGps } from "@/lib/location/client/enrich-project-payload"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

type NewProjectDialogProps = {
  onSubmit: (input: NewProjectInput) => void | Promise<void> | Promise<Project>
}

const emptyForm: NewProjectInput = {
  name: "",
  code: "",
  client: "",
  type: "fiber",
  location: "",
  sharedLocation: "",
  latitude: null,
  longitude: null,
  description: "",
  startDate: "",
  endDate: "",
  supervisor: "",
}

export function NewProjectDialog({ onSubmit }: NewProjectDialogProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<NewProjectInput>(emptyForm)
  const [baselineForm, setBaselineForm] = useState<NewProjectInput>(emptyForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)

  const isDirty = isFormStateDirty(form, baselineForm)
  const {
    handleOpenChange,
    requestClose,
    forceClose,
    discardOpen,
    setDiscardOpen,
    confirmDiscard,
  } = useProtectedFormDialog({ open, onOpenChange: setOpen, isDirty })

  useEffect(() => {
    if (open) {
      setForm(emptyForm)
      setBaselineForm(emptyForm)
      setGpsError(null)
      setIsSubmitting(false)
    }
  }, [open])

  function updateField<K extends keyof NewProjectInput>(
    key: K,
    value: NewProjectInput[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
    if (key === "sharedLocation") {
      setGpsError(null)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setGpsError(null)
    setIsSubmitting(true)
    try {
      const enriched = await enrichProjectInputWithResolvedGps(form)
      await onSubmit(enriched)
      setForm(emptyForm)
      forceClose()
    } catch (error) {
      console.error("[PROJECT CREATE]", error)
      setGpsError(
        error instanceof Error
          ? error.message
          : "No se pudo resolver la ubicación GPS."
      )
    } finally {
      setIsSubmitting(false)
    }
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
        <DialogTrigger asChild>
          <Button size="sm" className="gap-1.5">
            <Plus className="size-4" />
            Nueva Obra
          </Button>
        </DialogTrigger>
        <ProtectedFormDialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
          onRequestClose={requestClose}
          isDirty={isDirty}
        >
        <DialogHeader>
          <DialogTitle>Nueva Obra</DialogTitle>
          <DialogDescription>
            Registre una nueva obra de infraestructura o telecomunicaciones.
          </DialogDescription>
        </DialogHeader>

        <form id="new-project-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Nombre de la obra</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Despliegue FTTH Zona Norte"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Código</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(event) => updateField("code", event.target.value)}
                placeholder="FO-2026-001"
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client">Cliente</Label>
              <Input
                id="client"
                value={form.client}
                onChange={(event) => updateField("client", event.target.value)}
                placeholder="Nombre del cliente"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(value) =>
                  updateField("type", value as ProjectType)
                }
              >
                <SelectTrigger id="type" className="w-full">
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
              id="supervisor"
              value={form.supervisor}
              onValueChange={(value) => updateField("supervisor", value)}
            />

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="location">Ubicación / dirección</Label>
              <Input
                id="location"
                value={form.location}
                onChange={(event) => updateField("location", event.target.value)}
                placeholder="Monterrey, N.L. — Col. Mitras"
              />
            </div>

            <div className="sm:col-span-2">
              <SharedLocationInput
                id="project-gps"
                label="Ubicación GPS (opcional)"
                value={form.sharedLocation ?? ""}
                onChange={(value) => updateField("sharedLocation", value)}
                placeholder="https://maps.app.goo.gl/... o lat,lng"
              />
              {gpsError ? (
                <p className="mt-1 text-xs text-destructive">{gpsError}</p>
              ) : null}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(event) =>
                  updateField("description", event.target.value)
                }
                placeholder="Alcance, entregables y consideraciones técnicas..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Fecha de inicio (opcional)</Label>
              <Input
                id="startDate"
                type="date"
                value={form.startDate}
                onChange={(event) =>
                  updateField("startDate", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Fecha estimada de fin (opcional)</Label>
              <Input
                id="endDate"
                type="date"
                value={form.endDate}
                onChange={(event) => updateField("endDate", event.target.value)}
              />
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={requestClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="new-project-form"
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? "Creando..." : "Crear Obra"}
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
