"use client"

import { useEffect, useState } from "react"

import type { CrewMember, NewCrewMemberInput } from "@/lib/types/crews"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type MemberFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  member?: CrewMember
  onSubmit: (input: NewCrewMemberInput) => Promise<void>
}

const emptyForm: NewCrewMemberInput = {
  name: "",
  role: "",
  phone: "",
  active: true,
}

export function MemberFormDialog({
  open,
  onOpenChange,
  mode,
  member,
  onSubmit,
}: MemberFormDialogProps) {
  const [form, setForm] = useState<NewCrewMemberInput>(emptyForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    setError(null)
    setForm(
      mode === "edit" && member
        ? {
            name: member.name,
            role: member.role,
            phone: member.phone ?? "",
            active: member.active,
          }
        : emptyForm
    )
  }, [open, mode, member])

  function updateField<K extends keyof NewCrewMemberInput>(
    key: K,
    value: NewCrewMemberInput[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!form.name.trim() || !form.role.trim()) {
      setError("Nombre y rol son obligatorios.")
      return
    }

    setIsSubmitting(true)

    try {
      await onSubmit({
        name: form.name.trim(),
        role: form.role.trim(),
        phone: form.phone?.trim() || undefined,
        active: form.active,
      })
      onOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar el integrante."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const isValid = form.name.trim() !== "" && form.role.trim() !== ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Agregar integrante" : "Editar integrante"}
          </DialogTitle>
          <DialogDescription>
            Complete los datos del integrante de la cuadrilla.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="member-name">Nombre</Label>
            <Input
              id="member-name"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-role">Rol</Label>
            <Input
              id="member-role"
              value={form.role}
              onChange={(event) => updateField("role", event.target.value)}
              placeholder="Ej. Técnico Fibra"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-phone">Teléfono (opcional)</Label>
            <Input
              id="member-phone"
              value={form.phone ?? ""}
              onChange={(event) => updateField("phone", event.target.value)}
              placeholder="+52 ..."
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="member-active"
              checked={form.active}
              onCheckedChange={(checked) =>
                updateField("active", checked === true)
              }
            />
            <Label htmlFor="member-active">Integrante activo</Label>
          </div>

          {error && (
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
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting
                ? "Guardando..."
                : mode === "create"
                  ? "Agregar"
                  : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
