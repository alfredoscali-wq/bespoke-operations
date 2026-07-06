"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"

import { DeletePermanentDialog } from "@/components/admin/delete-permanent-dialog"
import { Button } from "@/components/ui/button"
import { canShowPermanentDeleteAction } from "@/lib/admin/permanent-delete-policy"
import type { PermanentDeleteEntityType } from "@/lib/admin/permanent-delete-types"
import { useAuth } from "@/components/auth/auth-provider"

type PermanentDeleteRowActionProps = {
  entityType: PermanentDeleteEntityType
  entityId: string
  entityLabel: string
  onSuccess: (message: string) => void
  disabled?: boolean
  title?: string
}

export function PermanentDeleteRowAction({
  entityType,
  entityId,
  entityLabel,
  onSuccess,
  disabled = false,
  title = "Eliminar definitivamente",
}: PermanentDeleteRowActionProps) {
  const { sessionUser } = useAuth()
  const [open, setOpen] = useState(false)

  if (!canShowPermanentDeleteAction(sessionUser?.systemRole)) {
    return null
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-destructive hover:text-destructive disabled:text-muted-foreground disabled:opacity-50"
        title={disabled ? undefined : title}
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <Trash2 className="size-4" />
        <span className="sr-only">{title}</span>
      </Button>

      <DeletePermanentDialog
        open={open}
        onOpenChange={setOpen}
        entityType={entityType}
        entityId={entityId}
        entityLabel={entityLabel}
        onSuccess={onSuccess}
      />
    </>
  )
}
