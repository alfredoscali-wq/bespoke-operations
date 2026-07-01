"use client"

import { ExternalLink, X } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { resolvePlanningTaskAddress } from "@/lib/planificacion/planning-edit"
import {
  resolvePlanningTaskClientLabel,
  resolvePlanningTaskCrewLabel,
  resolvePlanningTaskLocality,
  resolvePlanningTaskServiceLabel,
  resolvePlanningTaskShiftDisplayLabel,
} from "@/lib/planificacion/planning-utils"
import { TASK_STATUS_LABELS } from "@/lib/tasks/constants"
import type { Task } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"

type PlanningTaskReadonlyPanelProps = {
  task: Task | null
  open: boolean
  onClose: () => void
  className?: string
}

export function PlanningTaskReadonlyPanel({
  task,
  open,
  onClose,
  className,
}: PlanningTaskReadonlyPanelProps) {
  if (!open || !task) {
    return null
  }

  return (
    <section
      className={cn(
        "flex h-full min-h-[420px] w-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm xl:w-96",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">
            Detalle de la OT
          </h2>
          <p className="text-xs text-muted-foreground">
            Vista de solo lectura del despacho confirmado.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          onClick={onClose}
          aria-label="Cerrar detalle"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4">
        <section className="space-y-3 rounded-lg border bg-muted/15 p-4">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Información operativa
          </h3>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Cliente</dt>
              <dd className="font-medium text-foreground">
                {resolvePlanningTaskClientLabel(task)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Dirección</dt>
              <dd className="font-medium text-foreground">
                {resolvePlanningTaskAddress(task)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tipo de OT</dt>
              <dd className="font-medium text-foreground">
                {resolvePlanningTaskServiceLabel(task)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Localidad</dt>
              <dd className="font-medium text-foreground">
                {resolvePlanningTaskLocality(task)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Estado</dt>
              <dd className="font-medium text-foreground">
                {TASK_STATUS_LABELS[task.status]}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Cuadrilla</dt>
              <dd className="font-medium text-foreground">
                {resolvePlanningTaskCrewLabel(task)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Turno</dt>
              <dd className="font-medium text-foreground">
                {resolvePlanningTaskShiftDisplayLabel(task)}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Duración estimada</dt>
              <dd className="font-medium text-foreground">
                {task.estimatedDuration || "—"}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="border-t px-4 py-3">
        <Button type="button" variant="outline" className="w-full gap-2" asChild>
          <Link href={`/tareas/${task.id}`}>
            <ExternalLink className="size-3.5" />
            Ir a Órdenes de Trabajo
          </Link>
        </Button>
      </div>
    </section>
  )
}
