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
import { getTaskStatusSurfaceClass } from "@/lib/tasks/status-visual"
import { getWorkOrderServiceTypeLabel } from "@/lib/tasks/work-order"
import { formatTaskAdminDisplayCode, isFieldServiceTask } from "@/lib/tasks/utils"
import type { Task } from "@/lib/types/tasks"
import { cn } from "@/lib/utils"

type TasksAdminListTableProps = {
  tasks: Task[]
  hasActiveFilter?: boolean
  readOnly?: boolean
  showExtendedColumns?: boolean
  detailBasePath?: string
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

function resolveTaskTypeLabel(task: Task): string {
  return (
    getWorkOrderServiceTypeLabel(task.serviceType) ??
    (task.title?.trim() || "—")
  )
}

function resolveTaskOperarioLabel(task: Task): string {
  return task.supervisor?.trim() || "—"
}

export function TasksAdminListTable({
  tasks,
  hasActiveFilter = false,
  readOnly = false,
  showExtendedColumns = false,
  detailBasePath = "/tareas",
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
              {showExtendedColumns ? <TableHead>Tipo</TableHead> : null}
              {!showExtendedColumns ? <TableHead>Estado</TableHead> : null}
              <TableHead>Cuadrilla</TableHead>
              <TableHead>Fecha</TableHead>
              {showExtendedColumns ? <TableHead>Operario</TableHead> : null}
              {showExtendedColumns ? <TableHead>Estado</TableHead> : null}
              <TableHead className="w-[120px] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow
                key={task.id}
                className={cn("group", getTaskStatusSurfaceClass(task.status))}
              >
                <TableCell className="font-mono text-xs font-medium">
                  <Link
                    href={`${detailBasePath}/${task.id}`}
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
                {showExtendedColumns ? (
                  <TableCell className="max-w-[160px] truncate text-muted-foreground">
                    {resolveTaskTypeLabel(task)}
                  </TableCell>
                ) : null}
                {!showExtendedColumns ? (
                  <TableCell>
                    <TaskStatusBadge status={task.status} />
                  </TableCell>
                ) : null}
                <TableCell className="max-w-[140px] truncate text-muted-foreground">
                  {resolveTaskCrewDisplayName(task, getCrew)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatTaskDate(task.dueDate)}
                </TableCell>
                {showExtendedColumns ? (
                  <TableCell className="max-w-[120px] truncate text-muted-foreground">
                    {resolveTaskOperarioLabel(task)}
                  </TableCell>
                ) : null}
                {showExtendedColumns ? (
                  <TableCell>
                    <TaskStatusBadge status={task.status} />
                  </TableCell>
                ) : null}
                <TableCell className="text-right">
                  <TaskAdminRowActions
                    task={task}
                    onFeedback={setFeedback}
                    readOnly={readOnly}
                    detailHref={`${detailBasePath}/${task.id}`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
