"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  APP_MODULE_DEFINITIONS,
  type AppModuleKey,
  type ModuleVisibilityMap,
} from "@/lib/roles/app-modules"
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

  function handleToggle(key: AppModuleKey, checked: boolean) {
    if (!visibility || isAdministratorRole) {
      return
    }

    if (key === "settings" && role?.code === ADMINISTRATOR_ROLE_CODE) {
      return
    }

    setVisibility((current) =>
      current
        ? {
            ...current,
            [key]: checked,
          }
        : current
    )
  }

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
          </SheetDescription>
        </SheetHeader>

        <form
          id="role-edit-form"
          onSubmit={(event) => void handleSubmit(event)}
          className="flex flex-1 flex-col gap-3 overflow-y-auto px-4"
        >
          {APP_MODULE_DEFINITIONS.map((definition) => {
            const checked = visibility?.[definition.key] ?? false
            const disabled =
              isSubmitting ||
              isAdministratorRole

            return (
              <div
                key={definition.key}
                className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3"
              >
                <div>
                  <Label htmlFor={`module-${definition.key}`}>
                    {definition.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">Visible</p>
                </div>
                <Checkbox
                  id={`module-${definition.key}`}
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(value) =>
                    handleToggle(definition.key, value === true)
                  }
                />
              </div>
            )
          })}

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
