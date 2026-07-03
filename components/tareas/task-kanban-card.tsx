"use client"

import { useMemo } from "react"
import Link from "next/link"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { TaskRowActions } from "@/components/tareas/task-row-actions"
import { TaskOperationBadge, TaskPriorityBadge, TaskStatusBadge } from "@/components/tareas/task-badges"
import { isFieldServiceTask } from "@/lib/tasks/utils"
import { resolveTaskCrewDisplayName } from "@/lib/tasks/crew-relation"
import { formatTaskDate } from "@/lib/tasks/constants"
import { getTaskStatusSurfaceClass } from "@/lib/tasks/status-visual"
import type { Task } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

type TaskKanbanCardProps = {
  task: Task
  onFeedback: (input: {
    variant: "success" | "error"
    message: string
  }) => void
}

export function TaskKanbanCard({ task, onFeedback }: TaskKanbanCardProps) {
  const { getCrew } = useCrews()
  const crewDisplayName = useMemo(
    () => resolveTaskCrewDisplayName(task, getCrew),
    [task, getCrew]
  )

  return (
    <Card
      className={cn(
        "gap-0 border py-0 shadow-sm transition-shadow hover:shadow-md",
        getTaskStatusSurfaceClass(task.status, { accent: false, ring: true })
      )}
    >
      <CardHeader className="gap-2 px-3 pt-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <Link
              href={`/tareas/${task.id}`}
              className="font-mono text-[11px] font-semibold text-primary hover:underline"
            >
              {task.code}
            </Link>
            <TaskOperationBadge task={task} className="w-fit text-[10px]" />
          </div>
          <div className="flex shrink-0 items-start gap-1">
            <TaskPriorityBadge priority={task.priority} className="text-[10px]" />
            <TaskRowActions
              task={task}
              onFeedback={onFeedback}
              triggerClassName="size-7 hover:bg-muted"
            />
          </div>
        </div>
        <Link
          href={`/tareas/${task.id}`}
          className="text-sm leading-snug font-medium text-foreground hover:text-primary"
        >
          {task.title}
        </Link>
      </CardHeader>

      <CardContent className="space-y-3 px-3 pb-3">
        <div className="flex items-center justify-between gap-2">
          <TaskStatusBadge status={task.status} className="text-[10px]" />
        </div>

        <div className="space-y-1 text-[11px] text-muted-foreground">
          <p className="font-mono">
            {isFieldServiceTask(task)
              ? task.workOrderNumber ?? "Servicio"
              : task.projectCode}
          </p>
          <p>
            {isFieldServiceTask(task)
              ? task.customerCompany ?? task.customerName
              : crewDisplayName}
          </p>
          <p>{formatTaskDate(task.dueDate)}</p>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Checklist</span>
            <span className="font-medium tabular-nums">{task.progress}%</span>
          </div>
          <Progress value={task.progress} className="h-1.5" />
        </div>
      </CardContent>
    </Card>
  )
}
