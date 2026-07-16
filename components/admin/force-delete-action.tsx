"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"

import { ForceDeleteDialog } from "@/components/admin/force-delete-dialog"
import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { requestForceDelete } from "@/lib/admin/force-delete.client"
import { canShowForceDeleteAction } from "@/lib/admin/force-delete-policy"
import type { ForceDeleteEntityType } from "@/lib/admin/force-delete-types"

type ForceDeleteActionProps = {
  entityType: ForceDeleteEntityType
  entityId: string
  entityLabel: string
  onSuccess: (message: string) => void
  /** menu-item | button (default) | icon */
  presentation?: "button" | "menu-item" | "icon"
  disabled?: boolean
}

/**
 * Admin-only "⚠️ Forzar eliminación" entry point.
 * Soft-deletes via /api/admin/force-delete regardless of operational status.
 */
export function ForceDeleteAction({
  entityType,
  entityId,
  entityLabel,
  onSuccess,
  presentation = "button",
  disabled = false,
}: ForceDeleteActionProps) {
  const { sessionUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!canShowForceDeleteAction(sessionUser?.systemRole)) {
    return null
  }

  async function handleConfirm() {
    setIsSubmitting(true)
    setError(null)

    const result = await requestForceDelete({ entityType, entityId })

    setIsSubmitting(false)

    if (!result.success) {
      setError(result.message ?? "No se pudo forzar la eliminación.")
      return
    }

    setOpen(false)
    onSuccess(
      result.entityLabel
        ? `Eliminación forzada: ${result.entityLabel}.`
        : "Eliminación forzada correctamente."
    )
  }

  function openDialog() {
    setError(null)
    setOpen(true)
  }

  return (
    <>
      {presentation === "menu-item" ? (
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          disabled={disabled}
          onSelect={(event) => {
            event.preventDefault()
            openDialog()
          }}
        >
          <AlertTriangle className="size-4" />
          ⚠️ Forzar eliminación
        </DropdownMenuItem>
      ) : presentation === "icon" ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-destructive hover:text-destructive"
              disabled={disabled}
              onClick={openDialog}
              aria-label="Forzar eliminación"
            >
              <AlertTriangle className="size-4" />
              <span className="sr-only">⚠️ Forzar eliminación</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>⚠️ Forzar eliminación</TooltipContent>
        </Tooltip>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={disabled}
          onClick={openDialog}
        >
          <AlertTriangle className="size-4" />
          ⚠️ Forzar eliminación
        </Button>
      )}

      <ForceDeleteDialog
        open={open}
        onOpenChange={setOpen}
        entityLabel={entityLabel}
        onConfirm={handleConfirm}
        isSubmitting={isSubmitting}
        error={error}
      />
    </>
  )
}
