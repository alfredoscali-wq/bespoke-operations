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
import type {
  EmployeeTypeCatalog,
  EmployeeTypeCatalogInput,
} from "@/lib/types/employee-types"

type EmployeeTypeFormSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  record?: EmployeeTypeCatalog
  isSubmitting?: boolean
  onSubmit: (input: EmployeeTypeCatalogInput) => Promise<void>
}

type FormState = EmployeeTypeCatalogInput

function buildDefaultForm(): FormState {
  return {
    name: "",
    description: "",
    isActive: true,
  }
}

function buildEditForm(record: EmployeeTypeCatalog): FormState {
  return {
    name: record.name,
    description: record.description ?? "",
    isActive: record.isActive,
  }
}

export function EmployeeTypeFormSheet({
  open,
  onOpenChange,
  mode,
  record,
  isSubmitting = false,
  onSubmit,
}: EmployeeTypeFormSheetProps) {
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
      setError("Ingrese un nombre para el tipo de empleado.")
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
          : "No se pudo guardar el tipo de empleado."
      )
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {mode === "create" ? "Nuevo tipo de empleado" : "Editar tipo de empleado"}
          </SheetTitle>
          <SheetDescription>
            Clasifique el personal de su empresa sin mezclar áreas de acceso ni
            permisos web.
          </SheetDescription>
        </SheetHeader>

        <form
          id="employee-type-form"
          onSubmit={(event) => void handleSubmit(event)}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          <div className="space-y-2">
            <Label htmlFor="employee-type-name">Nombre</Label>
            <Input
              id="employee-type-name"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="Ej. Técnico de campo"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="employee-type-description">Descripción</Label>
            <Textarea
              id="employee-type-description"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              placeholder="Contexto operativo o administrativo del tipo."
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="employee-type-active">Estado</Label>
            <Select
              value={form.isActive ? "active" : "inactive"}
              onValueChange={(value) =>
                setForm((current) => ({
                  ...current,
                  isActive: value === "active",
                }))
              }
              disabled={isSubmitting}
            >
              <SelectTrigger id="employee-type-active">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="inactive">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "edit" && record ? (
            <p className="text-xs text-muted-foreground">
              Código técnico: <span className="font-mono">{record.code}</span> (no
              editable)
            </p>
          ) : null}

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
            form="employee-type-form"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Guardando..." : "Guardar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
