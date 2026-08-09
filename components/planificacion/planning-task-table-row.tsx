"use client"

import { AlertCircle, CornerUpLeft, MapPinOff, Pencil } from "lucide-react"

import { PlanningTaskOrderInput } from "@/components/planificacion/planning-task-order-input"
import { TaskOperationBadge, TaskStatusBadge } from "@/components/tareas/task-badges"
import { Button } from "@/components/ui/button"
import {
  countOperationalOrderReorderablesForTask,
  isOperationalOrderReorderable,
} from "@/lib/planificacion/planning-execution-order"
import {
  formatPlanningDurationCompact,
  formatPlanningDurationMinutesCompact,
} from "@/lib/planificacion/planning-ui-density"
import {
  formatPlanningMultiDayBadge,
  resolvePlanningDayDurationMinutes,
  resolvePlanningSpanDays,
} from "@/lib/planificacion/planning-date-range"
import { getTaskStatusSurfaceClass } from "@/lib/tasks/status-visual"
import { formatDispatchOrderBadge, resolveTaskRouteOrder } from "@/lib/tasks/dispatch-order"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import { formatTaskAdminDisplayCode } from "@/lib/tasks/utils"
import {
  hasPlanningTaskCrewObservations,
} from "@/lib/planificacion/planning-task-observations"
import {
  resolvePlanningTaskClientLabel,
  resolvePlanningTaskLocality,
  resolvePlanningTaskObraLabel,
  resolvePlanningTaskShiftDisplayLabel,
  resolveTaskPlanningCoordinates,
} from "@/lib/planificacion/planning-utils"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"

type PlanningTaskTableRowProps = {
  task: Task
  /** OPS 2.1A — selected planning calendar day. */
  planningDate: string
  crewColor: string
  readOnly?: boolean
  selected: boolean
  isReordering?: boolean
  rowId?: string
  allScopeTasks: Task[]
  crews: Pick<Crew, "id" | "name">[]
  onSelect: () => void
  onEdit?: () => void
  onReturnToAtencion?: () => void
  onMoveToPosition?: (taskId: string, position: number) => void
}

/**
 * OPS 2.4.7 — left columns: order number only (no arrow buttons), short OT code,
 * airy Cliente/Localidad.
 */
export function PlanningTaskTableRow({
  task,
  planningDate,
  crewColor,
  readOnly = false,
  selected,
  isReordering = false,
  rowId,
  allScopeTasks,
  crews,
  onSelect,
  onEdit,
  onReturnToAtencion,
  onMoveToPosition,
}: PlanningTaskTableRowProps) {
  const currentOrder = resolveTaskRouteOrder(task)
  const orderLabel = formatDispatchOrderBadge(currentOrder)
  const shiftLabel = resolvePlanningTaskShiftDisplayLabel(task)
  const spanDays = resolvePlanningSpanDays(task)
  const dayMinutes = resolvePlanningDayDurationMinutes(task, planningDate)
  const durationLabel =
    spanDays > 1
      ? formatPlanningDurationMinutesCompact(dayMinutes)
      : formatPlanningDurationCompact(task.estimatedDuration)
  const multiDayBadge = formatPlanningMultiDayBadge(task, planningDate)
  const displayCode = formatTaskAdminDisplayCode(task.code)
  const clientLabel = resolvePlanningTaskClientLabel(task)
  const obraLabel = resolvePlanningTaskObraLabel(task)
  const localityLabel = resolvePlanningTaskLocality(task)
  const canEditOrder =
    !readOnly &&
    isOperationalOrderReorderable(task) &&
    resolveTaskCrewId(task, crews) != null &&
    onMoveToPosition != null
  const maxOrder = countOperationalOrderReorderablesForTask(
    allScopeTasks,
    task.id,
    crews
  )
  const hasGps = resolveTaskPlanningCoordinates(task) != null
  const hasObservations = hasPlanningTaskCrewObservations(task)

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
        "group/row border-b transition-all duration-200",
        getTaskStatusSurfaceClass(task.status, { accent: false, ring: true }),
        selected &&
          "bg-sky-50/80 shadow-[inset_4px_0_0_0_#0284c7]",
        isReordering &&
          "bg-amber-50/70 shadow-[inset_4px_0_0_0_#d97706]",
        "cursor-pointer"
      )}
    >
      <td className="relative w-0 p-0">
        <span
          className={cn(
            "absolute inset-y-0 left-0 transition-[width] duration-200",
            selected ? "w-1.5" : "w-1"
          )}
          style={{ backgroundColor: crewColor }}
          aria-hidden
        />
      </td>

      <td className="px-1 py-1 text-center align-middle">
        {canEditOrder ? (
          <PlanningTaskOrderInput
            taskId={task.id}
            currentOrder={currentOrder}
            maxOrder={maxOrder}
            disabled={isReordering}
            onMoveToPosition={onMoveToPosition!}
          />
        ) : orderLabel ? (
          <span
            className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground"
            aria-label={`Orden operativo ${currentOrder}`}
          >
            {orderLabel}
          </span>
        ) : (
          <span className="inline-block size-6" aria-hidden />
        )}
      </td>

      <td className="px-1 py-1 align-middle">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onSelect()
            }}
            className="truncate text-left text-[11px] font-normal text-muted-foreground hover:underline"
            title={task.code}
          >
            {displayCode}
          </button>
          {obraLabel ? (
            <TaskOperationBadge
              task={task}
              className="max-w-full shrink-0 px-1 text-[9px] leading-3"
            />
          ) : null}
          {multiDayBadge ? (
            <span
              className="inline-flex shrink-0 rounded border border-sky-200 bg-sky-50 px-1 py-px text-[9px] font-medium leading-3 text-sky-800"
              title={multiDayBadge}
            >
              {multiDayBadge}
            </span>
          ) : null}
          {!hasGps ? (
            <span
              className="inline-flex shrink-0 items-center text-[10px] font-medium text-muted-foreground"
              title="Sin GPS disponible"
            >
              <MapPinOff className="size-3" aria-hidden />
              <span className="sr-only">Sin GPS</span>
            </span>
          ) : null}
        </div>
      </td>

      <td className="px-1.5 py-1 align-middle">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onSelect()
              }}
              className="min-w-0 truncate text-left text-[13px] font-semibold text-foreground hover:underline"
              title={clientLabel}
            >
              {clientLabel}
            </button>
            {hasObservations ? (
              <span
                className="inline-flex shrink-0 text-amber-600"
                title="Información para la Cuadrilla"
              >
                <AlertCircle className="size-3.5" aria-hidden />
                <span className="sr-only">Información para la Cuadrilla</span>
              </span>
            ) : null}
          </div>
          {obraLabel ? (
            <span
              className="truncate text-[11px] text-muted-foreground"
              title={obraLabel}
            >
              {obraLabel}
            </span>
          ) : null}
        </div>
      </td>

      <td className="px-1.5 py-1 align-middle">
        <span
          className="block truncate text-[13px] font-normal text-foreground/80"
          title={localityLabel}
        >
          {localityLabel}
        </span>
      </td>

      <td className="px-1 py-1 align-middle text-[12px] text-muted-foreground">
        <span className="block whitespace-nowrap" title={shiftLabel}>
          {shiftLabel}
        </span>
      </td>

      <td
        className="px-1 py-1 align-middle text-[12px] tabular-nums whitespace-nowrap text-muted-foreground"
        title={
          spanDays > 1
            ? `${task.estimatedDuration || "—"} · ${multiDayBadge ?? ""}`.trim()
            : task.estimatedDuration || undefined
        }
      >
        {durationLabel}
      </td>

      <td className="px-1 py-1 align-middle">
        <TaskStatusBadge
          status={task.status}
          className="max-w-full px-1.5 text-[10px] leading-4"
        />
      </td>

      <td className="px-0.5 py-1 align-middle">
        <div className="flex items-center justify-end gap-0">
          {!readOnly && onReturnToAtencion ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-6 text-muted-foreground hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation()
                onReturnToAtencion()
              }}
              aria-label="Devolver a Atención"
              title="Devolver a Atención"
            >
              <CornerUpLeft className="size-3.5" />
            </Button>
          ) : null}
          {!readOnly && onEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="size-6 text-muted-foreground hover:text-foreground"
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
            <span className="inline-block size-6" aria-hidden />
          )}
        </div>
      </td>
    </tr>
  )
}
