"use client"

import Link from "next/link"
import {
  Calendar,
  Clock,
  FolderKanban,
  MapPin,
  User,
  Users,
} from "lucide-react"

import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useProjects } from "@/components/obras/projects-provider"
import type { Task } from "@/lib/types/tasks"
import { formatTaskDate } from "@/lib/tasks/constants"
import { TaskEvidenceSummary } from "@/components/evidencias/task-evidence-summary"
import { TaskMaterialsPanel } from "@/components/materiales/task-materials-panel"
import { Progress } from "@/components/ui/progress"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  TaskPriorityBadge,
  TaskStatusBadge,
  TaskTypeBadge,
} from "@/components/tareas/task-badges"

type TaskOverviewTabProps = {
  task: Task
}

export function TaskOverviewTab({ task }: TaskOverviewTabProps) {
  const { projects } = useProjects()
  const { getCrew } = useCrews()

  const relatedProject = projects.find(
    (project) =>
      project.id === task.projectId || project.code === task.projectCode
  )
  const relatedCrew = task.crewId
    ? getCrew(task.crewId)
    : undefined

  const infoItems = [
    {
      icon: FolderKanban,
      label: "Proyecto",
      value: (
        <div>
          <p className="font-mono text-xs text-primary">{task.projectCode}</p>
          <p className="text-sm">{task.projectName}</p>
        </div>
      ),
    },
    { icon: User, label: "Supervisor", value: task.supervisor },
    {
      icon: Users,
      label: "Cuadrilla",
      value: relatedCrew ? (
        <Link
          href={`/cuadrillas/${relatedCrew.id}`}
          className="font-medium text-primary hover:underline"
        >
          {task.crew}
        </Link>
      ) : task.crew ? (
        task.crew
      ) : (
        "Sin cuadrilla asignada"
      ),
    },
    {
      icon: Calendar,
      label: "Fecha de inicio",
      value: formatTaskDate(task.startDate),
    },
    {
      icon: Calendar,
      label: "Fecha límite",
      value: formatTaskDate(task.dueDate),
    },
    {
      icon: Clock,
      label: "Duración estimada",
      value: task.estimatedDuration || "—",
    },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="shadow-sm lg:col-span-2">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-primary">
              {task.code}
            </span>
            <TaskTypeBadge type={task.type} />
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
          </div>
          <CardTitle className="text-lg">{task.title}</CardTitle>
          <CardDescription>{task.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {infoItems.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.label}
                  className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <div className="text-sm font-medium text-foreground">
                      {typeof item.value === "string" ? item.value : item.value}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-4 rounded-lg border bg-muted/20 p-3 text-sm">
            <p className="text-xs text-muted-foreground">Obra relacionada</p>
            <Link
              href={
                relatedProject ? `/obras/${relatedProject.id}` : "/obras"
              }
              className="mt-1 inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <MapPin className="size-3.5" />
              Ver proyecto {task.projectCode}
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Progreso del checklist</CardTitle>
            <CardDescription>Avance de entregables obligatorios</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <span className="text-4xl font-semibold tracking-tight tabular-nums">
                {task.progress}%
              </span>
            </div>
            <Progress value={task.progress} className="h-2.5" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {task.checklist.filter((item) => item.completed).length} de{" "}
              {task.checklist.length} elementos completados. Los ítems marcados
              como obligatorios deben estar listos antes de finalizar la tarea.
            </p>
          </CardContent>
        </Card>

        <TaskEvidenceSummary taskId={task.id} />
        <TaskMaterialsPanel taskId={task.id} />
      </div>
    </div>
  )
}
