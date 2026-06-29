"use client"

import { Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Task } from "@/lib/types/tasks"
import {
  resolvePlanningTaskClientLabel,
  resolvePlanningTaskCrewLabel,
  resolvePlanningTaskLocality,
  resolvePlanningTaskServiceLabel,
  resolveTaskShift,
} from "@/lib/planificacion/planning-utils"
import { WORK_ORDER_SHIFT_OPTIONS } from "@/lib/tasks/work-order"

type PlanningTaskCardProps = {
  task: Task
  selected: boolean
  onSelect: () => void
  onEdit: () => void
}

export function PlanningTaskCard({
  task,
  selected,
  onSelect,
  onEdit,
}: PlanningTaskCardProps) {
  const shiftValue = resolveTaskShift(task)
  const shiftLabel =
    WORK_ORDER_SHIFT_OPTIONS.find((option) => option.value === shiftValue)
      ?.label ?? "—"

  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border transition-colors",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card"
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full px-3 py-3 text-left hover:bg-muted/30"
      >
        <p className="text-sm font-semibold text-foreground">
          {resolvePlanningTaskClientLabel(task)}
        </p>
        <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between gap-2">
            <dt>Tipo</dt>
            <dd className="text-right font-medium text-foreground">
              {resolvePlanningTaskServiceLabel(task)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Localidad</dt>
            <dd className="text-right font-medium text-foreground">
              {resolvePlanningTaskLocality(task)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Cuadrilla sugerida</dt>
            <dd className="text-right font-medium text-foreground">
              {resolvePlanningTaskCrewLabel(task)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Turno</dt>
            <dd className="text-right font-medium text-foreground">{shiftLabel}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt>Duración</dt>
            <dd className="text-right font-medium text-foreground">
              {task.estimatedDuration || "—"}
            </dd>
          </div>
        </dl>
      </button>

      <div className="border-t px-3 py-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full gap-2"
          onClick={onEdit}
        >
          <Pencil className="size-3.5" />
          Editar
        </Button>
      </div>
    </article>
  )
}
