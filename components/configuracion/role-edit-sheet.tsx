"use client"

import { useEffect, useState } from "react"

import { AreaModulePicker } from "@/components/configuracion/area-module-picker"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { ModuleVisibilityMap } from "@/lib/roles/app-modules"
import { ADMINISTRATOR_ROLE_CODE } from "@/lib/roles/role-utils"
import type { CompanyRole } from "@/lib/types/company-roles"

type RoleEditSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: CompanyRole | null
  isSubmitting?: boolean
  onSubmit: (moduleVisibility: ModuleVisibilityMap) => Promise<void>
}

export function RoleEditSheet({
  open,
  onOpenChange,
  role,
  isSubmitting = false,
  onSubmit,
}: RoleEditSheetProps) {
  const [visibility, setVisibility] = useState<ModuleVisibilityMap | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isAdministratorRole = role?.code === ADMINISTRATOR_ROLE_CODE

  useEffect(() => {
    if (!open || !role) {
      return
    }

    setError(null)
    setVisibility({ ...role.moduleVisibility })
  }, [open, role])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (!visibility) {
      return
    }

    setError(null)

    try {
      await onSubmit(visibility)
      onOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar el área."
      )
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{role?.name ?? "Editar Área"}</SheetTitle>
          <SheetDescription>
            Defina qué pantallas del sistema estarán habilitadas para esta Área.
            La organización replica el menú lateral de Bespoke Operations.
          </SheetDescription>
        </SheetHeader>

        <form
          id="role-edit-form"
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-1 flex-col gap-3 overflow-y-auto px-4"
        >
          {visibility ? (
            <AreaModulePicker
              visibility={visibility}
              disabled={isSubmitting || isAdministratorRole}
              onChange={setVisibility}
            />
          ) : null}

          {isAdministratorRole ? (
            <p className="text-sm text-muted-foreground">
              El Área Administrador mantiene acceso completo y no puede
              restringir Configuración.
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
            form="role-edit-form"
            disabled={isSubmitting || isAdministratorRole}
          >
            {isSubmitting ? "Guardando..." : "Guardar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
