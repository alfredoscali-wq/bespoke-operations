"use client"

import { useState } from "react"
import Link from "next/link"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { OperationalTaskCardBody } from "@/components/tareas/operational-task-card-body"
import { TaskRowActions } from "@/components/tareas/task-row-actions"
import { useTasksUI } from "@/components/tareas/tasks-ui-provider"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"
import {
  OPERATIONAL_CATEGORY_KPI_LABELS,
} from "@/lib/tasks/operational-category"
import { resolveTaskCrewDisplayName } from "@/lib/tasks/crew-relation"
import { getTaskStatusSurfaceClass } from "@/lib/tasks/status-visual"
import type { Task } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"

type TasksOperationalListProps = {
  tasks: Task[]
}

export function TasksOperationalList({ tasks }: TasksOperationalListProps) {
  const { getCrew } = useCrews()
  const { selectedCategory } = useTasksUI()
  const [feedback, setFeedback] = useState<{
    variant: "success" | "error"
    message: string
  } | null>(null)

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          No se encontraron órdenes de trabajo
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {selectedCategory
            ? `No hay órdenes en ${OPERATIONAL_CATEGORY_KPI_LABELS[selectedCategory].toLowerCase()}.`
            : "Ajusta los filtros para ver más resultados."}
        </p>
      </div>
    )
  }

  return (
    <>
      <EntityActionFeedback
        message={feedback?.message ?? null}
        variant={feedback?.variant ?? "success"}
      />

      <div className="space-y-3">
        {tasks.map((task) => {
          const crewName = resolveTaskCrewDisplayName(task, getCrew)

          return (
            <article
              key={task.id}
              className={cn(
                "flex flex-col gap-3 rounded-xl border p-4 shadow-sm transition-colors hover:brightness-[0.98] sm:flex-row sm:items-start sm:justify-between",
                getTaskStatusSurfaceClass(task.status)
              )}
            >
              <Link href={`/tareas/${task.id}`} className="min-w-0 flex-1">
                <OperationalTaskCardBody task={task} crewLabel={crewName} />
              </Link>

              <TaskRowActions
                task={task}
                onFeedback={setFeedback}
                triggerClassName="size-8 hover:bg-muted"
                operationalMode
              />
            </article>
          )
        })}
      </div>
    </>
  )
}
