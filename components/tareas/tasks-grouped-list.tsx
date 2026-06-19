"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { TaskRowActions } from "@/components/tareas/task-row-actions"
import {
  TaskOperationBadge,
  TaskPriorityBadge,
  TaskStatusBadge,
} from "@/components/tareas/task-badges"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"
import {
  TASK_STATUS_LABELS,
  formatTaskDate,
} from "@/lib/tasks/constants"
import { resolveTaskCrewDisplayName } from "@/lib/tasks/crew-relation"
import type { Task, TaskStatus } from "@/lib/types/tasks"
import { isFieldServiceTask } from "@/lib/tasks/utils"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

type TasksGroupedListProps = {
  tasks: Task[]
  focusedStatus?: TaskStatus | null
}

const GROUP_ORDER: TaskStatus[] = [
  "pendiente",
  "asignada",
  "en-curso",
  "en-aprobacion",
  "finalizada",
  "cerrada",
  "cancelada",
]

const DEFAULT_EXPANDED: TaskStatus[] = [
  "pendiente",
  "asignada",
  "en-curso",
  "en-aprobacion",
]

function buildExpandedGroups(focusedStatus?: TaskStatus | null) {
  if (focusedStatus) {
    return GROUP_ORDER.reduce(
      (accumulator, status) => ({
        ...accumulator,
        [status]: status === focusedStatus,
      }),
      {} as Record<TaskStatus, boolean>
    )
  }

  return GROUP_ORDER.reduce(
    (accumulator, status) => ({
      ...accumulator,
      [status]: DEFAULT_EXPANDED.includes(status),
    }),
    {} as Record<TaskStatus, boolean>
  )
}

export function TasksGroupedList({
  tasks,
  focusedStatus = null,
}: TasksGroupedListProps) {
  const { getCrew } = useCrews()
  const [feedback, setFeedback] = useState<{
    variant: "success" | "error"
    message: string
  } | null>(null)
  const groupedTasks = useMemo(() => {
    return GROUP_ORDER.map((status) => ({
      status,
      label: TASK_STATUS_LABELS[status],
      tasks: tasks.filter((task) => task.status === status),
    }))
  }, [tasks])

  const [expandedGroups, setExpandedGroups] = useState<Record<TaskStatus, boolean>>(
    () => buildExpandedGroups(focusedStatus)
  )

  useEffect(() => {
    setExpandedGroups(buildExpandedGroups(focusedStatus))
  }, [focusedStatus])

  function toggleGroup(status: TaskStatus) {
    setExpandedGroups((current) => ({
      ...current,
      [status]: !current[status],
    }))
  }

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          No se encontraron tareas
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajusta los filtros para ver más resultados.
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
      {groupedTasks.map((group) => {
        const isExpanded = expandedGroups[group.status]

        return (
          <section
            key={group.status}
            className="overflow-hidden rounded-xl border bg-card shadow-sm"
          >
            <Button
              type="button"
              variant="ghost"
              className="h-auto w-full justify-between rounded-none px-4 py-3 hover:bg-muted/40"
              onClick={() => toggleGroup(group.status)}
            >
              <div className="flex items-center gap-3">
                <ChevronDown
                  className={cn(
                    "size-4 text-muted-foreground transition-transform",
                    isExpanded ? "rotate-0" : "-rotate-90"
                  )}
                />
                <span className="text-sm font-semibold text-foreground">
                  {group.label}
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  ({group.tasks.length})
                </span>
              </div>
            </Button>

            {isExpanded && group.tasks.length > 0 && (
              <div className="divide-y border-t">
                {group.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <Link
                      href={`/tareas/${task.id}`}
                      className="min-w-0 flex-1 space-y-2"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-primary">
                          {task.code}
                        </span>
                        <TaskOperationBadge task={task} className="text-[10px]" />
                        <TaskStatusBadge status={task.status} className="text-[10px]" />
                        <TaskPriorityBadge priority={task.priority} className="text-[10px]" />
                      </div>
                      <p className="font-medium text-foreground">{task.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {isFieldServiceTask(task)
                          ? [
                              task.customerCompany,
                              task.workOrderNumber,
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : [task.projectCode, resolveTaskCrewDisplayName(task, getCrew)]
                              .filter(Boolean)
                              .join(" · ")}
                      </p>
                    </Link>

                    <div className="flex w-full items-start justify-between gap-2 sm:w-auto sm:flex-col sm:items-end">
                      <div className="flex w-full flex-col gap-2 sm:w-56">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Vence {formatTaskDate(task.dueDate)}</span>
                          <span className="tabular-nums">{task.progress}%</span>
                        </div>
                        <Progress value={task.progress} className="h-1.5" />
                      </div>
                      <TaskRowActions
                        task={task}
                        onFeedback={setFeedback}
                        triggerClassName="size-8 hover:bg-muted"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isExpanded && group.tasks.length === 0 && (
              <div className="border-t px-4 py-6 text-sm text-muted-foreground">
                No hay tareas en este estado.
              </div>
            )}
          </section>
        )
      })}
      </div>
    </>
  )
}
