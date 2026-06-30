"use client"

import { useMemo } from "react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { PlanningTaskCard } from "@/components/planificacion/planning-task-card"
import {
  resolveExecutionOrderMoveAvailability,
  sortTasksForPlanningList,
} from "@/lib/planificacion/planning-execution-order"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"

type PlanningTaskListProps = {
  tasks: Task[]
  crews: Pick<Crew, "id" | "name">[]
  selectedTaskId: string | null
  reorderingTaskId?: string | null
  onSelectTask: (taskId: string) => void
  onEditTask: (taskId: string) => void
  onMoveExecutionOrder: (taskId: string, direction: "up" | "down") => void
  className?: string
}

export function PlanningTaskList({
  tasks,
  crews,
  selectedTaskId,
  reorderingTaskId = null,
  onSelectTask,
  onEditTask,
  onMoveExecutionOrder,
  className,
}: PlanningTaskListProps) {
  const sortedTasks = useMemo(
    () => sortTasksForPlanningList(tasks, crews),
    [tasks, crews]
  )

  return (
    <section
      className={cn(
        "flex min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm lg:w-80",
        className
      )}
    >
      <div className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">OT Programadas</h2>
        <p className="text-xs text-muted-foreground">
          {tasks.length} orden{tasks.length === 1 ? "" : "es"} para la jornada
        </p>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-3">
          {sortedTasks.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
              No hay OT programadas para la fecha seleccionada.
            </p>
          ) : (
            sortedTasks.map((task) => {
              const { canMoveUp, canMoveDown } = resolveExecutionOrderMoveAvailability(
                tasks,
                task.id,
                crews
              )

              return (
                <PlanningTaskCard
                  key={task.id}
                  task={task}
                  selected={task.id === selectedTaskId}
                  canMoveUp={canMoveUp}
                  canMoveDown={canMoveDown}
                  isReordering={reorderingTaskId === task.id}
                  onSelect={() => onSelectTask(task.id)}
                  onEdit={() => onEditTask(task.id)}
                  onMoveUp={() => onMoveExecutionOrder(task.id, "up")}
                  onMoveDown={() => onMoveExecutionOrder(task.id, "down")}
                />
              )
            })
          )}
        </div>
      </ScrollArea>
    </section>
  )
}
