"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { TaskAdminExecutionStatusBadge } from "@/components/tareas/task-admin-execution-status-badge"
import { TaskAdminTechnologyBadge } from "@/components/tareas/task-admin-technology-badge"
import { formatTaskAdminDisplayCode } from "@/lib/tasks/utils"
import type { Task } from "@/lib/types/tasks"
import { Button } from "@/components/ui/button"

type TaskAdminDetailHeaderProps = {
  task: Task
  embedded?: boolean
}

export function TaskAdminDetailHeader({
  task,
  embedded = false,
}: TaskAdminDetailHeaderProps) {
  const router = useRouter()

  return (
    <div className="space-y-3">
      {!embedded ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 h-8 gap-1.5 text-muted-foreground"
          onClick={() => router.back()}
        >
          <ArrowLeft className="size-4" />
          Volver
        </Button>
      ) : null}

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="font-mono text-sm font-semibold text-primary">
            {formatTaskAdminDisplayCode(task.code)}
          </span>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {task.title}
          </h1>
          <TaskAdminTechnologyBadge task={task} />
        </div>

        <div>
          <TaskAdminExecutionStatusBadge status={task.status} task={task} />
        </div>
      </div>
    </div>
  )
}
