"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"

import { DeletePermanentDialog } from "@/components/admin/delete-permanent-dialog"
import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import { canShowPermanentDeleteAction } from "@/lib/admin/permanent-delete-policy"
import type { PermanentDeleteEntityType } from "@/lib/admin/permanent-delete-types"

type PermanentDeleteActionProps = {
  entityType: PermanentDeleteEntityType
  entityId: string
  entityLabel: string
  onSuccess: (message: string) => void
  /**
   * Optional delete handler. When omitted, uses /api/admin/permanent-delete.
   * Prefer this for entities whose hard-delete is not yet wired in the shared API.
   */
  onDelete?: (input: {
    entityType: PermanentDeleteEntityType
    entityId: string
  }) => Promise<{ success: boolean; message?: string }>
  title?: string
  description?: string
  buttonLabel?: string
  disabled?: boolean
  className?: string
}

/**
 * Shared admin-only permanent delete entry point for detail screens.
 * Reuse across Comercial, Clientes, Obras, OT, etc.
 */
export function PermanentDeleteAction({
  entityType,
  entityId,
  entityLabel,
  onSuccess,
  onDelete,
  title,
  description,
  buttonLabel = "Eliminar definitivamente",
  disabled = false,
  className,
}: PermanentDeleteActionProps) {
  const { sessionUser } = useAuth()
  const [open, setOpen] = useState(false)

  if (!canShowPermanentDeleteAction(sessionUser?.systemRole)) {
    return null
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className={className ?? "h-9 gap-2"}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" aria-hidden />
        {buttonLabel}
      </Button>

      <DeletePermanentDialog
        open={open}
        onOpenChange={setOpen}
        entityType={entityType}
        entityId={entityId}
        entityLabel={entityLabel}
        onSuccess={onSuccess}
        onDelete={onDelete}
        title={title}
        description={description}
      />
    </>
  )
}
