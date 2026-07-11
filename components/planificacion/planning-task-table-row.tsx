"use client"

import { MapPinOff, Pencil } from "lucide-react"

import { TaskStatusBadge } from "@/components/tareas/task-badges"
import { Button } from "@/components/ui/button"
import { getTaskStatusSurfaceClass } from "@/lib/tasks/status-visual"
import { formatDispatchOrderBadge, resolveTaskRouteOrder } from "@/lib/tasks/dispatch-order"
import {
  resolvePlanningTaskClientLabel,
  resolvePlanningTaskLocality,
  resolvePlanningTaskShiftDisplayLabel,
  resolveTaskPlanningCoordinates,
} from "@/lib/planificacion/planning-utils"
import type { Task } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"

type PlanningTaskTableRowProps = {
  task: Task
  crewColor: string
  readOnly?: boolean
  selected: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  isReordering?: boolean
  rowId?: string
  onSelect: () => void
  onEdit?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}

export function PlanningTaskTableRow({
  task,
  crewColor,
  readOnly = false,
  selected,
  canMoveUp,
  canMoveDown,
  isReordering = false,
  rowId,
  onSelect,
  onEdit,
  onMoveUp,
  onMoveDown,
}: PlanningTaskTableRowProps) {
  const orderLabel = formatDispatchOrderBadge(resolveTaskRouteOrder(task))
  const shiftLabel = resolvePlanningTaskShiftDisplayLabel(task)
  const showOrderControls = !readOnly && (canMoveUp || canMoveDown)
  const hasGps = resolveTaskPlanningCoordinates(task) != null

  return (
    <tr
      id={rowId}
      onClick={onSelect}
      onDoubleClick={(event) => {
        event.stopPropagation()
        if (!readOnly && onEdit) {
          onEdit()
        }
      }}
      className={cn(
        "group/row border-b transition-colors",
        getTaskStatusSurfaceClass(task.status, { accent: false, ring: true }),
        selected && "brightness-[0.98] ring-2 ring-primary/20",
        "cursor-pointer"
      )}
    >
      <td className="relative w-0 p-0">
        <span
          className="absolute inset-y-0 left-0 w-1"
          style={{ backgroundColor: crewColor }}
          aria-hidden
        />
      </td>

      <td className="w-10 px-2 py-2 text-center align-middle">
        {orderLabel ? (
          <span
            className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground"
            aria-label={`Orden operativo ${resolveTaskRouteOrder(task)}`}
          >
            {orderLabel}
          </span>
        ) : (
          <span className="inline-block size-7" aria-hidden />
        )}
      </td>

      <td className="w-10 px-1 py-2 align-middle">
        {showOrderControls ? (
          <div className="flex flex-col items-center gap-0.5">
            {canMoveUp ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-6 text-xs text-muted-foreground hover:text-foreground"
                disabled={isReordering}
                onClick={(event) => {
                  event.stopPropagation()
                  onMoveUp?.()
                }}
                aria-label="Subir orden"
                title="Subir orden"
              >
                ▲
              </Button>
            ) : null}
            {canMoveDown ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-6 text-xs text-muted-foreground hover:text-foreground"
                disabled={isReordering}
                onClick={(event) => {
                  event.stopPropagation()
                  onMoveDown?.()
                }}
                aria-label="Bajar orden"
                title="Bajar orden"
              >
                ▼
              </Button>
            ) : null}
          </div>
        ) : (
          <span className="inline-block size-7" aria-hidden />
        )}
      </td>

      <td className="whitespace-nowrap px-2 py-2 align-middle">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onSelect()
            }}
            className="text-left text-sm font-medium text-foreground hover:underline"
          >
            {task.code}
          </button>
          {!hasGps ? (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground"
              title="Sin GPS disponible"
            >
              <MapPinOff className="size-3" aria-hidden />
              <span className="sr-only">Sin GPS</span>
            </span>
          ) : null}
        </div>
      </td>

      <td className="min-w-[140px] px-2 py-2 align-middle">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onSelect()
          }}
          className="max-w-[220px] truncate text-left text-sm text-foreground hover:underline"
          title={resolvePlanningTaskClientLabel(task)}
        >
          {resolvePlanningTaskClientLabel(task)}
        </button>
      </td>

      <td className="min-w-[120px] px-2 py-2 align-middle">
        <span
          className="block max-w-[180px] truncate text-sm text-muted-foreground"
          title={resolvePlanningTaskLocality(task)}
        >
          {resolvePlanningTaskLocality(task)}
        </span>
      </td>

      <td className="whitespace-nowrap px-2 py-2 align-middle text-sm text-muted-foreground">
        {shiftLabel}
      </td>

      <td className="whitespace-nowrap px-2 py-2 align-middle text-sm text-muted-foreground">
        {task.estimatedDuration || "—"}
      </td>

      <td className="whitespace-nowrap px-2 py-2 align-middle">
        <TaskStatusBadge status={task.status} />
      </td>

      <td className="whitespace-nowrap px-2 py-2 align-middle">
        {!readOnly && onEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation()
              onEdit()
            }}
            aria-label="Ajustar planificación"
            title="Ajustar planificación"
          >
            <Pencil className="size-3.5" />
          </Button>
        ) : (
          <span className="inline-block size-7" aria-hidden />
        )}
      </td>
    </tr>
  )
}

