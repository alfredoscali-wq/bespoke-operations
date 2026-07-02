"use client"

import { useState } from "react"
import Link from "next/link"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { TaskAdminRowActions } from "@/components/tareas/task-admin-row-actions"
import { TaskStatusBadge } from "@/components/tareas/task-badges"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { resolveTaskCrewDisplayName } from "@/lib/tasks/crew-relation"
import { formatTaskDate } from "@/lib/tasks/constants"
import { formatTaskAdminDisplayCode, isFieldServiceTask } from "@/lib/tasks/utils"
import type { Task } from "@/lib/types/tasks"

type TasksAdminListTableProps = {
  tasks: Task[]
  hasActiveFilter?: boolean
}

function resolveTaskCustomerLabel(task: Task): string {
  if (isFieldServiceTask(task)) {
    return task.customerName?.trim() || task.customerCompany?.trim() || "—"
  }

  return task.projectName?.trim() || "—"
}

function resolveTaskAddressLabel(task: Task): string {
  const address = task.serviceAddress?.trim()
  const locality = task.locality?.trim()

  if (address && locality) {
    return `${address}, ${locality}`
  }

  return address || locality || "—"
}

export function TasksAdminListTable({
  tasks,
  hasActiveFilter = false,
}: TasksAdminListTableProps) {
  const { getCrew } = useCrews()
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
          {hasActiveFilter
            ? "Ajusta la búsqueda para ver más resultados."
            : "No hay órdenes de trabajo registradas."}
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

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[90px]">Código</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Cuadrilla</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="w-[120px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id} className="group">
                <TableCell className="font-mono text-xs font-medium">
                  <Link
                    href={`/tareas/${task.id}`}
                    className="hover:text-primary"
                  >
                    {formatTaskAdminDisplayCode(task.code)}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[180px] truncate">
                  {resolveTaskCustomerLabel(task)}
                </TableCell>
                <TableCell className="max-w-[240px] truncate text-muted-foreground">
                  {resolveTaskAddressLabel(task)}
                </TableCell>
                <TableCell>
                  <TaskStatusBadge status={task.status} />
                </TableCell>
                <TableCell className="max-w-[140px] truncate text-muted-foreground">
                  {resolveTaskCrewDisplayName(task, getCrew)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatTaskDate(task.dueDate)}
                </TableCell>
                <TableCell className="text-right">
                  <TaskAdminRowActions task={task} onFeedback={setFeedback} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
