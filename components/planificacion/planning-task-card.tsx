"use client"

import { ChevronDown, ChevronUp, Pencil } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Task } from "@/lib/types/tasks"
import {
  formatPlanningExecutionOrderDisplay,
} from "@/lib/planificacion/planning-execution-order"
import {
  resolvePlanningTaskClientLabel,
  resolvePlanningTaskCrewLabel,
  resolvePlanningTaskLocality,
  resolvePlanningTaskServiceLabel,
  resolvePlanningTaskShiftDisplayLabel,
} from "@/lib/planificacion/planning-utils"

type PlanningTaskCardProps = {
  task: Task
  selected: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  isReordering?: boolean
  onSelect: () => void
  onEdit: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}

export function PlanningTaskCard({
  task,
  selected,
  canMoveUp,
  canMoveDown,
  isReordering = false,
  onSelect,
  onEdit,
  onMoveUp,
  onMoveDown,
}: PlanningTaskCardProps) {
  const shiftLabel = resolvePlanningTaskShiftDisplayLabel(task)
  const orderLabel = formatPlanningExecutionOrderDisplay(task.executionOrder)

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
        <div className="flex items-start gap-2">
          {orderLabel ? (
            <span
              className="shrink-0 text-sm leading-none text-muted-foreground"
              aria-label={`Orden ${task.executionOrder}`}
            >
              {orderLabel}
            </span>
          ) : null}
          <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">
            {resolvePlanningTaskClientLabel(task)}
          </p>
        </div>
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

      <div className="flex items-center gap-2 border-t px-3 py-2">
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="size-8"
            disabled={!canMoveUp || isReordering}
            onClick={onMoveUp}
            aria-label="Subir orden de ejecución"
            title="Subir"
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="size-8"
            disabled={!canMoveDown || isReordering}
            onClick={onMoveDown}
            aria-label="Bajar orden de ejecución"
            title="Bajar"
          >
            <ChevronDown className="size-4" />
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 min-w-0 flex-1 gap-2"
          onClick={onEdit}
        >
          <Pencil className="size-3.5" />
          Editar
        </Button>
      </div>
    </article>
  )
}
