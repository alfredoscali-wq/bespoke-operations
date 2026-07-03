"use client"

import { useState } from "react"

import type { Task } from "@/lib/types/tasks"
import {
  KANBAN_COLUMNS,
  TASK_STATUS_LABELS,
} from "@/lib/tasks/constants"
import { getTaskStatusSurfaceClass } from "@/lib/tasks/status-visual"
import { TaskKanbanCard } from "@/components/tareas/task-kanban-card"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"
import { Badge } from "@/components/ui/badge"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

type TasksKanbanProps = {
  tasks: Task[]
}

export function TasksKanban({ tasks }: TasksKanbanProps) {
  const [feedback, setFeedback] = useState<{
    variant: "success" | "error"
    message: string
  } | null>(null)

  return (
    <>
      <EntityActionFeedback
        message={feedback?.message ?? null}
        variant={feedback?.variant ?? "success"}
      />

      <ScrollArea className="w-full whitespace-nowrap">
      <div className="flex gap-4 pb-4">
        {KANBAN_COLUMNS.map((status) => {
          const columnTasks = tasks.filter((task) => task.status === status)

          return (
            <div
              key={status}
              className={cn(
                "flex w-[280px] shrink-0 flex-col rounded-xl border sm:w-[300px]",
                getTaskStatusSurfaceClass(status, { accent: false })
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-between border-b px-3 py-3",
                  getTaskStatusSurfaceClass(status, { accent: true, ring: false })
                )}
              >
                <h3 className="text-sm font-medium text-foreground">
                  {TASK_STATUS_LABELS[status]}
                </h3>
                <Badge variant="secondary" className="text-[10px]">
                  {columnTasks.length}
                </Badge>
              </div>

              <ScrollArea className="max-h-[calc(100vh-320px)] min-h-[400px]">
                <div className="space-y-3 p-3">
                  {columnTasks.length === 0 ? (
                    <div className="rounded-lg border border-dashed bg-background/50 px-3 py-8 text-center text-xs text-muted-foreground">
                      Sin órdenes de trabajo
                    </div>
                  ) : (
                    columnTasks.map((task) => (
                      <TaskKanbanCard
                        key={task.id}
                        task={task}
                        onFeedback={setFeedback}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
    </>
  )
}
