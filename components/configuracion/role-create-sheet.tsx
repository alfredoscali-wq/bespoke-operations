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
import type { CompanyRole } from "@/lib/types/company-roles"

type RoleCreateSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles: CompanyRole[]
  isSubmitting?: boolean
  onSubmit: (input: { name: string; copyFromRoleId: string }) => Promise<void>
}

export function RoleCreateSheet({
  open,
  onOpenChange,
  roles,
  isSubmitting = false,
  onSubmit,
}: RoleCreateSheetProps) {
  const [name, setName] = useState("")
  const [copyFromRoleId, setCopyFromRoleId] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    setError(null)
    setName("")
    setCopyFromRoleId(roles[0]?.id ?? "")
  }, [open, roles])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("Ingrese un nombre para el rol.")
      return
    }

    if (!copyFromRoleId) {
      setError("Seleccione un rol de referencia.")
      return
    }

    try {
      await onSubmit({ name: name.trim(), copyFromRoleId })
      onOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo crear el rol."
      )
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Nuevo Rol</SheetTitle>
          <SheetDescription>
            Copie la configuración de un rol existente como punto de partida.
          </SheetDescription>
        </SheetHeader>

        <form
          id="role-create-form"
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          <div className="space-y-2">
            <Label htmlFor="role-name">Nombre del Rol</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role-copy-from">Copiar configuración desde</Label>
            <Select
              value={copyFromRoleId}
              onValueChange={setCopyFromRoleId}
              disabled={isSubmitting}
            >
              <SelectTrigger id="role-copy-from">
                <SelectValue placeholder="Seleccione un rol" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
            form="role-create-form"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creando..." : "Crear Rol"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
