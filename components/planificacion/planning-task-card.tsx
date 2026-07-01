"use client"

import { ChevronDown, ChevronUp, Route } from "lucide-react"

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
import { TASK_STATUS_LABELS } from "@/lib/tasks/constants"

type PlanningTaskCardProps = {
  task: Task
  readOnly?: boolean
  selected: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  isReordering?: boolean
  onSelect: () => void
  onOrganize?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}

export function PlanningTaskCard({
  task,
  readOnly = false,
  selected,
  canMoveUp,
  canMoveDown,
  isReordering = false,
  onSelect,
  onOrganize,
  onMoveUp,
  onMoveDown,
}: PlanningTaskCardProps) {
  const shiftLabel = resolvePlanningTaskShiftDisplayLabel(task)
  const orderLabel = formatPlanningExecutionOrderDisplay(task.executionOrder)
  const hasCrewControls = !readOnly && (canMoveUp || canMoveDown)

  return (
    <article
      className={cn(
        "group/card overflow-hidden rounded-lg border transition-colors",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border bg-card"
      )}
    >
      <div className="flex gap-2 px-2 pt-2">
        {hasCrewControls ? (
          <div className="flex w-7 shrink-0 flex-col items-center gap-0.5 pt-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-6 text-muted-foreground opacity-100 hover:text-foreground md:opacity-0 md:transition-opacity md:group-hover/card:opacity-100"
              disabled={!canMoveUp || isReordering}
              onClick={(event) => {
                event.stopPropagation()
                onMoveUp?.()
              }}
              aria-label="Subir en la lista"
              title="Subir"
            >
              <ChevronUp className="size-3.5" />
            </Button>
            {orderLabel ? (
              <span
                className="text-sm leading-none text-muted-foreground"
                aria-label={`Orden ${task.executionOrder}`}
              >
                {orderLabel}
              </span>
            ) : (
              <span className="size-3.5" aria-hidden />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-6 text-muted-foreground opacity-100 hover:text-foreground md:opacity-0 md:transition-opacity md:group-hover/card:opacity-100"
              disabled={!canMoveDown || isReordering}
              onClick={(event) => {
                event.stopPropagation()
                onMoveDown?.()
              }}
              aria-label="Bajar en la lista"
              title="Bajar"
            >
              <ChevronDown className="size-3.5" />
            </Button>
          </div>
        ) : orderLabel ? (
          <div className="flex w-7 shrink-0 justify-center pt-1">
            <span
              className="text-sm leading-none text-muted-foreground"
              aria-label={`Orden ${task.executionOrder}`}
            >
              {orderLabel}
            </span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 px-1 py-1 text-left hover:bg-muted/30"
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
              <dt>Cuadrilla</dt>
              <dd className="text-right font-medium text-foreground">
                {resolvePlanningTaskCrewLabel(task)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Turno</dt>
              <dd className="text-right font-medium text-foreground">{shiftLabel}</dd>
            </div>
            {readOnly ? (
              <div className="flex justify-between gap-2">
                <dt>Estado</dt>
                <dd className="text-right font-medium text-foreground">
                  {TASK_STATUS_LABELS[task.status]}
                </dd>
              </div>
            ) : (
              <div className="flex justify-between gap-2">
                <dt>Duración</dt>
                <dd className="text-right font-medium text-foreground">
                  {task.estimatedDuration || "—"}
                </dd>
              </div>
            )}
          </dl>
        </button>
      </div>

      {!readOnly && onOrganize ? (
        <div className="border-t px-3 py-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full gap-2"
            onClick={onOrganize}
          >
            <Route className="size-3.5" />
            Organizar despacho
          </Button>
        </div>
      ) : null}
    </article>
  )
}
