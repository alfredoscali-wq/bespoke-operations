"use client"

import { useMemo } from "react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { PlanningTaskCard } from "@/components/planificacion/planning-task-card"
import {
  resolveExecutionOrderMoveAvailability,
  sortTasksForPlanningList,
} from "@/lib/planificacion/planning-execution-order"
import type { PlanningDispatchMode } from "@/lib/planificacion/planning-dispatch"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"

type PlanningTaskListProps = {
  mode: PlanningDispatchMode
  tasks: Task[]
  crews: Pick<Crew, "id" | "name">[]
  selectedTaskId: string | null
  reorderingTaskId?: string | null
  onSelectTask: (taskId: string) => void
  onOrganizeTask?: (taskId: string) => void
  onMoveExecutionOrder?: (taskId: string, direction: "up" | "down") => void
  className?: string
}

export function PlanningTaskList({
  mode,
  tasks,
  crews,
  selectedTaskId,
  reorderingTaskId = null,
  onSelectTask,
  onOrganizeTask,
  onMoveExecutionOrder,
  className,
}: PlanningTaskListProps) {
  const readOnly = mode === "confirmed"
  const sortedTasks = useMemo(
    () => sortTasksForPlanningList(tasks, crews),
    [tasks, crews]
  )

  const title = readOnly ? "OT del despacho" : "OT programadas"
  const emptyMessage = readOnly
    ? "No hay OT en despacho para la fecha seleccionada."
    : "No hay OT programadas para la fecha seleccionada."

  return (
    <section
      className={cn(
        "flex min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm lg:w-80",
        className
      )}
    >
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">
          {tasks.length} orden{tasks.length === 1 ? "" : "es"} para la jornada
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-3">
          {sortedTasks.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          ) : (
            sortedTasks.map((task) => {
              const { canMoveUp, canMoveDown } = readOnly
                ? { canMoveUp: false, canMoveDown: false }
                : resolveExecutionOrderMoveAvailability(tasks, task.id, crews)

              return (
                <PlanningTaskCard
                  key={task.id}
                  task={task}
                  readOnly={readOnly}
                  selected={task.id === selectedTaskId}
                  canMoveUp={canMoveUp}
                  canMoveDown={canMoveDown}
                  isReordering={reorderingTaskId === task.id}
                  onSelect={() => onSelectTask(task.id)}
                  onOrganize={
                    onOrganizeTask ? () => onOrganizeTask(task.id) : undefined
                  }
                  onMoveUp={
                    onMoveExecutionOrder
                      ? () => onMoveExecutionOrder(task.id, "up")
                      : undefined
                  }
                  onMoveDown={
                    onMoveExecutionOrder
                      ? () => onMoveExecutionOrder(task.id, "down")
                      : undefined
                  }
                />
              )
            })
          )}
        </div>
      </ScrollArea>
    </section>
  )
}
