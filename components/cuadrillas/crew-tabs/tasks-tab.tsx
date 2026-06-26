import Link from "next/link"

import {
  TaskPriorityBadge,
  TaskStatusBadge,
} from "@/components/tareas/task-badges"
import { getCrewTasks } from "@/lib/crews/utils"
import { formatTaskDate } from "@/lib/tasks/constants"
import type { Crew } from "@/lib/types/crews"
import type { Task } from "@/lib/types/tasks"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type CrewTasksTabProps = {
  crew: Crew
  tasks: Task[]
}

export function CrewTasksTab({ crew, tasks }: CrewTasksTabProps) {
  const crewTasks = getCrewTasks(crew, tasks)

  if (crewTasks.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Órdenes de Trabajo asignadas</CardTitle>
          <CardDescription>
            No hay órdenes de trabajo registradas para esta cuadrilla.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Órdenes de Trabajo asignadas</CardTitle>
        <CardDescription>
          {crewTasks.length}{" "}
          {crewTasks.length === 1 ? "orden de trabajo" : "órdenes de trabajo"} vinculadas a{" "}
          {crew.name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="hidden overflow-hidden rounded-xl border lg:block">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>OT</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha límite</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crewTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell>
                    <Link
                      href={`/tareas/${task.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {task.code}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {task.title}
                    </p>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{task.projectCode}</span>
                    <p className="max-w-[180px] truncate text-xs text-muted-foreground">
                      {task.projectName}
                    </p>
                  </TableCell>
                  <TableCell>
                    <TaskPriorityBadge priority={task.priority} />
                  </TableCell>
                  <TableCell>
                    <TaskStatusBadge status={task.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatTaskDate(task.dueDate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-3 lg:hidden">
          {crewTasks.map((task) => (
            <Link
              key={task.id}
              href={`/tareas/${task.id}`}
              className="block rounded-lg border bg-muted/20 p-3 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-primary">{task.code}</p>
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.projectCode}
                  </p>
                </div>
                <TaskStatusBadge status={task.status} />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <TaskPriorityBadge priority={task.priority} />
                <span className="text-xs text-muted-foreground">
                  Vence {formatTaskDate(task.dueDate)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
