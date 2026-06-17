"use client"

import { useState } from "react"
import Link from "next/link"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { TaskRowActions } from "@/components/tareas/task-row-actions"
import type { Task } from "@/lib/types/tasks"
import { resolveTaskCrewDisplayName } from "@/lib/tasks/crew-relation"
import { formatTaskDate } from "@/lib/tasks/constants"
import { isFieldServiceTask } from "@/lib/tasks/utils"
import {
  TaskOperationBadge,
  TaskPriorityBadge,
  TaskStatusBadge,
  TaskTypeBadge,
} from "@/components/tareas/task-badges"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TasksListTableProps = {
  tasks: Task[]
}

export function TasksListTable({ tasks }: TasksListTableProps) {
  const { getCrew } = useCrews()
  const [feedback, setFeedback] = useState<{
    variant: "success" | "error"
    message: string
  } | null>(null)

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

      <div className="hidden overflow-hidden rounded-xl border bg-card shadow-sm lg:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[90px]">Código</TableHead>
                <TableHead>Tarea</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Proyecto / Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Cuadrilla</TableHead>
                <TableHead>Fecha límite</TableHead>
                <TableHead className="min-w-[120px]">Progreso</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id} className="group">
                  <TableCell className="font-mono text-xs font-medium">
                    {task.code}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/tareas/${task.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {task.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      <TaskOperationBadge task={task} />
                    </div>
                  </TableCell>
                  <TableCell>
                    {isFieldServiceTask(task) ? (
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{task.customerCompany}</p>
                        <p className="max-w-[180px] truncate text-xs text-muted-foreground">
                          {task.customerName}
                        </p>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-muted-foreground">
                          {task.projectCode}
                        </p>
                        <p className="max-w-[180px] truncate text-xs">
                          {task.projectName}
                        </p>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <TaskTypeBadge type={task.type} />
                  </TableCell>
                  <TableCell>
                    <TaskStatusBadge status={task.status} />
                  </TableCell>
                  <TableCell>
                    <TaskPriorityBadge priority={task.priority} />
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate text-muted-foreground">
                    {resolveTaskCrewDisplayName(task, getCrew)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatTaskDate(task.dueDate)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={task.progress} className="h-1.5 flex-1" />
                      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
                        {task.progress}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <TaskRowActions
                      task={task}
                      onFeedback={setFeedback}
                      triggerClassName="size-8 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {tasks.map((task) => (
          <Card key={task.id} className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/tareas/${task.id}`} className="min-w-0 flex-1">
                  <p className="font-mono text-xs font-medium text-primary">
                    {task.code}
                  </p>
                  <CardTitle className="text-sm leading-snug">{task.title}</CardTitle>
                  <CardDescription className="font-mono text-[11px]">
                    {isFieldServiceTask(task)
                      ? task.workOrderNumber ?? task.customerCompany
                      : task.projectCode}
                  </CardDescription>
                </Link>
                <div className="flex flex-col items-end gap-1.5">
                  <TaskOperationBadge task={task} className="text-[10px]" />
                  <TaskPriorityBadge priority={task.priority} />
                  <TaskRowActions task={task} onFeedback={setFeedback} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <TaskTypeBadge type={task.type} />
                <TaskStatusBadge status={task.status} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span>{resolveTaskCrewDisplayName(task, getCrew)}</span>
                <span>{formatTaskDate(task.dueDate)}</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Progreso</span>
                  <span className="font-medium">{task.progress}%</span>
                </div>
                <Progress value={task.progress} className="h-1.5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
