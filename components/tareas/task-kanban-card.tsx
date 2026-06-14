"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"

import { useTasks } from "@/components/tareas/tasks-provider"
import { TaskOperationBadge, TaskPriorityBadge } from "@/components/tareas/task-badges"
import { isFieldServiceTask } from "@/lib/tasks/utils"
import {
  TASK_STATUS_LABELS,
  formatTaskDate,
} from "@/lib/tasks/constants"
import { canMoveToStatus } from "@/lib/tasks/utils"
import type { Task, TaskStatus } from "@/lib/types/tasks"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

type TaskKanbanCardProps = {
  task: Task
}

export function TaskKanbanCard({ task }: TaskKanbanCardProps) {
  const { updateTaskStatus } = useTasks()
  const [error, setError] = useState<string | null>(null)

  function handleStatusChange(newStatus: TaskStatus) {
    const result = updateTaskStatus(task.id, newStatus)
    if (!result.success) {
      setError(result.message ?? "No se pudo actualizar el estado.")
      return
    }
    setError(null)
  }

  return (
    <Card className="gap-0 py-0 shadow-sm transition-shadow hover:shadow-md">
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
          <TaskPriorityBadge priority={task.priority} className="text-[10px]" />
        </div>
        <Link
          href={`/tareas/${task.id}`}
          className="text-sm leading-snug font-medium text-foreground hover:text-primary"
        >
          {task.title}
        </Link>
      </CardHeader>

      <CardContent className="space-y-3 px-3 pb-3">
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <p className="font-mono">
            {isFieldServiceTask(task)
              ? task.workOrderNumber ?? "Servicio"
              : task.projectCode}
          </p>
          <p>
            {isFieldServiceTask(task)
              ? task.customerCompany ?? task.customerName
              : task.crew}
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

        {error && (
          <Alert variant="destructive" className="py-2">
            <AlertTriangle className="size-3.5" />
            <AlertDescription className="text-[11px]">{error}</AlertDescription>
          </Alert>
        )}

        <Select value={task.status} onValueChange={handleStatusChange}>
          <SelectTrigger
            className="h-7 w-full text-xs"
            onClick={(event) => event.stopPropagation()}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(
              [
                "pendiente",
                "asignada",
                "en-curso",
                "finalizada",
                "en-aprobacion",
                "cerrada",
              ] as TaskStatus[]
            ).map((status) => {
              const validation = canMoveToStatus(task, status)
              return (
                <SelectItem
                  key={status}
                  value={status}
                  disabled={!validation.allowed && status !== task.status}
                >
                  {TASK_STATUS_LABELS[status]}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  )
}
