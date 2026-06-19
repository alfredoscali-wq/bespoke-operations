"use client"

import { useState } from "react"
import Link from "next/link"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { TaskRowActions } from "@/components/tareas/task-row-actions"
import { TaskOperationalCategoryBadge } from "@/components/tareas/task-operational-badge"
import { useTasksUI } from "@/components/tareas/tasks-ui-provider"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"
import { formatTaskDate } from "@/lib/tasks/constants"
import {
  formatTaskOperationalCode,
  OPERATIONAL_CATEGORY_KPI_LABELS,
  resolveTaskAddressLabel,
  resolveTaskClientLabel,
  resolveTaskCrewOperationalLabel,
} from "@/lib/tasks/operational-category"
import { resolveTaskOperationalTitle } from "@/lib/tasks/work-order"
import { resolveTaskCrewDisplayName } from "@/lib/tasks/crew-relation"
import type { Task } from "@/lib/types/tasks"

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
              className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/20 sm:flex-row sm:items-start sm:justify-between"
            >
              <Link
                href={`/tareas/${task.id}`}
                className="min-w-0 flex-1 space-y-3"
              >
                <h3 className="text-base font-semibold text-foreground">
                  {resolveTaskOperationalTitle(task)}
                </h3>

                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>{resolveTaskClientLabel(task)}</p>
                  <p>{resolveTaskAddressLabel(task)}</p>
                </div>

                <div className="space-y-1 text-sm text-foreground">
                  <p>{formatTaskDate(task.dueDate)}</p>
                  <p>{resolveTaskCrewOperationalLabel(crewName)}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <TaskOperationalCategoryBadge task={task} />
                </div>

                <p className="font-mono text-[11px] text-muted-foreground/80">
                  {formatTaskOperationalCode(task.code)}
                </p>
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
