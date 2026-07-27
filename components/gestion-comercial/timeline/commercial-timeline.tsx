"use client"

import { useMemo, useState } from "react"

import {
  useCommercialActivities,
  useDeleteCommercialActivity,
  useDuplicateCommercialActivity,
} from "@/components/gestion-comercial/commercial-activities-provider"
import { CommercialTimelineFilterBar } from "@/components/gestion-comercial/timeline/commercial-timeline-filter"
import { CommercialTimelineGroup } from "@/components/gestion-comercial/timeline/commercial-timeline-group"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TableRowsSkeleton } from "@/components/ui/kpi-grid-skeleton"
import {
  filterCommercialActivities,
  groupCommercialActivitiesByDate,
  type CommercialTimelineFilter,
} from "@/lib/commercial/timeline"
import type { CommercialActivityListItem } from "@/lib/types/commercial-activities"

type CommercialTimelineProps = {
  onEdit: (activity: CommercialActivityListItem) => void
  onCreateFirst: () => void
}

export function CommercialTimeline({
  onEdit,
  onCreateFirst,
}: CommercialTimelineProps) {
  const {
    data: activities,
    isLoading,
    hasMore,
    isLoadingMore,
    loadMore,
    stats,
    highlightedActivityId,
  } = useCommercialActivities()
  const { mutateAsync: deleteActivity } = useDeleteCommercialActivity()
  const { mutateAsync: duplicateActivity } = useDuplicateCommercialActivity()

  const [filter, setFilter] = useState<CommercialTimelineFilter>("all")
  const [pendingDelete, setPendingDelete] =
    useState<CommercialActivityListItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const filtered = useMemo(
    () => filterCommercialActivities(activities, filter),
    [activities, filter]
  )
  const groups = useMemo(
    () => groupCommercialActivitiesByDate(filtered),
    [filtered]
  )

  async function handleDelete() {
    if (!pendingDelete) return
    setIsDeleting(true)
    setActionError(null)
    try {
      const result = await deleteActivity(pendingDelete.id)
      if (!result.success) {
        setActionError(result.message ?? "No se pudo eliminar la actividad.")
        return
      }
      setPendingDelete(null)
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleDuplicate(activity: CommercialActivityListItem) {
    setActionError(null)
    const result = await duplicateActivity(activity)
    if (!result.success) {
      setActionError(result.message ?? "No se pudo duplicar la actividad.")
    }
  }

  if (isLoading) {
    return <TableRowsSkeleton rows={5} columns={3} />
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">
            Actividad Comercial
          </h2>
          <p className="text-xs text-muted-foreground">
            {stats.total} actividades · {stats.pending} pendientes ·{" "}
            {stats.completed} completadas
          </p>
        </div>
      </div>

      <CommercialTimelineFilterBar value={filter} onChange={setFilter} />

      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}

      {activities.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
          <p className="text-sm text-muted-foreground">
            Aún no existen actividades comerciales.
          </p>
          <Button type="button" onClick={onCreateFirst}>
            Crear primera actividad
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay actividades para este filtro en lo cargado.
        </p>
      ) : (
        <div className="space-y-5 md:space-y-7">
          {groups.map((group) => (
            <CommercialTimelineGroup
              key={group.key}
              group={group}
              highlightedActivityId={highlightedActivityId}
              onEdit={onEdit}
              onDelete={setPendingDelete}
              onDuplicate={(activity) => void handleDuplicate(activity)}
            />
          ))}
        </div>
      )}

      {hasMore ? (
        <div className="flex justify-center pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoadingMore}
            onClick={() => void loadMore()}
          >
            {isLoadingMore ? "Cargando…" : "Cargar actividades anteriores"}
          </Button>
        </div>
      ) : null}

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setPendingDelete(null)
            setActionError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Eliminar actividad</DialogTitle>
            <DialogDescription>
              La actividad se eliminará con soft delete y dejará de mostrarse
              en la timeline.
            </DialogDescription>
          </DialogHeader>
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
    </section>
  )
}
