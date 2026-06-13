import Link from "next/link"

import type { ProjectTask } from "@/lib/types/projects"
import { formatDate } from "@/lib/projects/constants"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
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

type ProjectTasksTabProps = {
  tasks: ProjectTask[]
}

const priorityStyles = {
  alta: "bg-red-50 text-red-700 border-red-100",
  media: "bg-amber-50 text-amber-700 border-amber-100",
  baja: "bg-slate-100 text-slate-600 border-slate-200",
}

const statusLabels = {
  pendiente: "Pendiente",
  "en-curso": "En Curso",
  completada: "Completada",
}

const statusStyles = {
  pendiente: "bg-slate-100 text-slate-700",
  "en-curso": "bg-blue-50 text-blue-700",
  completada: "bg-emerald-50 text-emerald-700",
}

function isLinkedTaskId(id: string) {
  return id.startsWith("task-")
}

export function ProjectTasksTab({ tasks }: ProjectTasksTabProps) {
  if (tasks.length === 0) {
    return (
      <Card className="border-dashed shadow-sm">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No hay tareas asociadas a esta obra.
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border bg-card shadow-sm lg:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Tarea</TableHead>
              <TableHead>Cuadrilla</TableHead>
              <TableHead>Fecha límite</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell className="font-medium">
                  {isLinkedTaskId(task.id) ? (
                    <Link
                      href={`/tareas/${task.id}`}
                      className="hover:text-primary"
                    >
                      {task.title}
                    </Link>
                  ) : (
                    task.title
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {task.assignee}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(task.dueDate)}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn("capitalize", priorityStyles[task.priority])}
                  >
                    {task.priority}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={cn(statusStyles[task.status])}
                  >
                    {statusLabels[task.status]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 lg:hidden">
        {tasks.map((task) => {
          const content = (
            <>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm leading-snug">{task.title}</CardTitle>
                <CardDescription>{task.assignee}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge variant="outline" className={priorityStyles[task.priority]}>
                  {task.priority}
                </Badge>
                <Badge variant="secondary" className={statusStyles[task.status]}>
                  {statusLabels[task.status]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDate(task.dueDate)}
                </span>
              </CardContent>
            </>
          )

          if (isLinkedTaskId(task.id)) {
            return (
              <Link key={task.id} href={`/tareas/${task.id}`}>
                <Card size="sm" className="shadow-sm transition-colors hover:bg-muted/30">
                  {content}
                </Card>
              </Link>
            )
          }

          return (
            <Card key={task.id} size="sm" className="shadow-sm">
              {content}
            </Card>
          )
        })}
      </div>
    </>
  )
}
