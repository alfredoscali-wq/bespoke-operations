"use client"

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { useState } from "react"

import {
  COMMERCIAL_ACTIVITY_TYPE_ICONS,
  CommercialActivityStatusIcon,
} from "@/components/gestion-comercial/commercial-activity-icons"
import { useDeleteCommercialActivity } from "@/components/gestion-comercial/commercial-activities-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TableRowsSkeleton } from "@/components/ui/kpi-grid-skeleton"
import {
  COMMERCIAL_ACTIVITY_STATUS_LABELS,
} from "@/lib/commercial/activity-catalogs"
import {
  displayCommercialValue,
  formatCommercialDateTime,
} from "@/lib/commercial/display"
import type { CommercialActivityListItem } from "@/lib/types/commercial-activities"

type CommercialActivityListProps = {
  activities: CommercialActivityListItem[]
  isLoading?: boolean
  onEdit: (activity: CommercialActivityListItem) => void
}

export function CommercialActivityList({
  activities,
  isLoading = false,
  onEdit,
}: CommercialActivityListProps) {
  const { mutateAsync: deleteActivity } = useDeleteCommercialActivity()
  const [pendingDelete, setPendingDelete] =
    useState<CommercialActivityListItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    if (!pendingDelete) return
    setIsDeleting(true)
    setError(null)
    try {
      const result = await deleteActivity(pendingDelete.id)
      if (!result.success) {
        setError(result.message ?? "No se pudo eliminar la actividad.")
        return
      }
      setPendingDelete(null)
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return <TableRowsSkeleton rows={4} columns={3} />
  }

  if (activities.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Todavía no hay actividades registradas.
      </p>
    )
  }

  return (
    <>
      <ul className="divide-y rounded-md border">
        {activities.map((activity) => {
          const Icon = COMMERCIAL_ACTIVITY_TYPE_ICONS[activity.activityTypeCode]
          return (
            <li
              key={activity.id}
              className="flex items-start gap-3 px-3 py-2.5"
            >
              <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                <Icon className="size-4 text-muted-foreground" aria-hidden />
              </div>

              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {activity.activityTypeLabel}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <CommercialActivityStatusIcon status={activity.status} />
                    {COMMERCIAL_ACTIVITY_STATUS_LABELS[activity.status]}
                  </span>
                </div>
                <p className="text-sm font-medium leading-snug">
                  {activity.title}
                </p>
                {activity.description.trim() ? (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {activity.description}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>
                    {displayCommercialValue(activity.employeeName)}
                  </span>
                  <span>{formatCommercialDateTime(activity.createdAt)}</span>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label="Acciones de actividad"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(activity)}>
                    <Pencil className="size-4" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setPendingDelete(activity)}
                  >
                    <Trash2 className="size-4" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          )
        })}
      </ul>

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setPendingDelete(null)
            setError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Eliminar actividad</DialogTitle>
            <DialogDescription>
              La actividad se eliminará con soft delete y dejará de mostrarse
              en el expediente.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingDelete(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
