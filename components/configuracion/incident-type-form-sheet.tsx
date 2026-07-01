"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  DEFAULT_INCIDENT_TYPE_COLOR,
  INCIDENT_TYPE_COLOR_PRESETS,
} from "@/lib/incident-types/colors"
import type { IncidentType, IncidentTypeInput } from "@/lib/types/incident-types"
import { cn } from "@/lib/utils"

type IncidentTypeFormSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  record?: IncidentType
  isSubmitting?: boolean
  onSubmit: (input: IncidentTypeInput) => Promise<void>
}

type FormState = IncidentTypeInput

function buildDefaultForm(): FormState {
  return {
    name: "",
    description: "",
    color: DEFAULT_INCIDENT_TYPE_COLOR,
    pausesWorkOrder: true,
    requiresSupervisorIntervention: false,
    notifySupervisor: true,
    isActive: true,
  }
}

function buildEditForm(record: IncidentType): FormState {
  return {
    name: record.name,
    description: record.description,
    color: record.color,
    pausesWorkOrder: record.pausesWorkOrder,
    requiresSupervisorIntervention: record.requiresSupervisorIntervention,
    notifySupervisor: record.notifySupervisor,
    isActive: record.isActive,
  }
}

function BooleanSelect({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string
  label: string
  value: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value ? "yes" : "no"}
        onValueChange={(next) => onChange(next === "yes")}
        disabled={disabled}
      >
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="yes">Sí</SelectItem>
          <SelectItem value="no">No</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

export function IncidentTypeFormSheet({
  open,
  onOpenChange,
  mode,
  record,
  isSubmitting = false,
  onSubmit,
}: IncidentTypeFormSheetProps) {
  const [form, setForm] = useState<FormState>(buildDefaultForm)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    setError(null)
    setForm(mode === "edit" && record ? buildEditForm(record) : buildDefaultForm())
  }, [mode, open, record])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!form.name.trim()) {
      setError("Ingrese un nombre para el tipo de incidencia.")
      return
    }

    try {
      await onSubmit({
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
      })
      onOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar el tipo de incidencia."
      )
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {mode === "create" ? "Nueva Incidencia" : "Editar Incidencia"}
          </SheetTitle>
          <SheetDescription>
            Defina cómo las cuadrillas podrán reportar este tipo de incidencia
            durante la ejecución de una OT.
          </SheetDescription>
        </SheetHeader>

        <form
          id="incident-type-form"
          onSubmit={(event) => void handleSubmit(event)}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          <div className="space-y-2">
            <Label htmlFor="incident-name">Nombre</Label>
            <Input
              id="incident-name"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Ej. Cliente ausente"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="incident-description">Descripción</Label>
            <Textarea
              id="incident-description"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Contexto operativo para el equipo de campo."
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="incident-color">Color</Label>
            <div className="flex flex-wrap items-center gap-2">
              {INCIDENT_TYPE_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-label={`Color ${preset}`}
                  className={cn(
                    "size-8 rounded-full border-2 transition-transform hover:scale-105",
                    form.color === preset
                      ? "border-foreground"
                      : "border-transparent"
                  )}
                  style={{ backgroundColor: preset }}
                  onClick={() =>
                    setForm((current) => ({ ...current, color: preset }))
                  }
                  disabled={isSubmitting}
                />
              ))}
              <Input
                id="incident-color"
                type="color"
                value={form.color}
                onChange={(event) =>
                  setForm((current) => ({ ...current, color: event.target.value }))
                }
                className="h-10 w-16 cursor-pointer p-1"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <BooleanSelect
            id="incident-pauses"
            label="Pausa la OT"
            value={form.pausesWorkOrder}
            onChange={(value) =>
              setForm((current) => ({ ...current, pausesWorkOrder: value }))
            }
            disabled={isSubmitting}
          />

          <BooleanSelect
            id="incident-supervisor-intervention"
            label="Requiere intervención del supervisor"
            value={form.requiresSupervisorIntervention}
            onChange={(value) =>
              setForm((current) => ({
                ...current,
                requiresSupervisorIntervention: value,
              }))
            }
            disabled={isSubmitting}
          />

          <BooleanSelect
            id="incident-notify"
            label="Notificar Supervisor"
            value={form.notifySupervisor}
            onChange={(value) =>
              setForm((current) => ({ ...current, notifySupervisor: value }))
            }
            disabled={isSubmitting}
          />

          <BooleanSelect
            id="incident-active"
            label="Activa"
            value={form.isActive}
            onChange={(value) =>
              setForm((current) => ({ ...current, isActive: value }))
            }
            disabled={isSubmitting}
          />

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </form>

        <SheetFooter className="gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="incident-type-form"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Guardando..." : "Guardar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
