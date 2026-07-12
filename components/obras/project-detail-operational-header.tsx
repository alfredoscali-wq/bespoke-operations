"use client"

import Link from "next/link"
import {
  ArrowLeft,
  CalendarDays,
  MapPin,
  MoreHorizontal,
  Pencil,
} from "lucide-react"

import { ProjectProgressBar } from "@/components/obras/project-progress-bar"
import { ProjectStatusBadge } from "@/components/obras/project-badges"
import { formatDate } from "@/lib/projects/constants"
import type { Project } from "@/lib/types/projects"
import type { Task } from "@/lib/types/tasks"
import { getProjectOperationalStats } from "@/lib/projects/utils"
import { getTasksForProject } from "@/lib/tasks/utils"
import { isPendingClosureStatus } from "@/lib/tasks/task-status-workflow"
import type { getProjectActions } from "@/lib/projects/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type ProjectAction = ReturnType<typeof getProjectActions>[number]

type ProjectDetailOperationalHeaderProps = {
  project: Project
  tasks: Task[]
  isBusy: boolean
  primaryActions: ProjectAction[]
  secondaryActions: ProjectAction[]
  onAction: (actionId: ProjectAction["id"]) => void
  onEditLocation: () => void
}

function formatGpsCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): string | null {
  if (latitude == null || longitude == null) {
    return null
  }

  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
}

export function ProjectDetailOperationalHeader({
  project,
  tasks,
  isBusy,
  primaryActions,
  secondaryActions,
  onAction,
  onEditLocation,
}: ProjectDetailOperationalHeaderProps) {
  const projectTasks = getTasksForProject(project, tasks)
  const stats = getProjectOperationalStats(project, tasks, [], [])
  const pendingClosureCount = projectTasks.filter((task) =>
    isPendingClosureStatus(task.status)
  ).length
  const gpsLabel = formatGpsCoordinates(project.latitude, project.longitude)

  const summaryItems = [
    { label: "Total OT", value: projectTasks.length },
    { label: "Activas", value: stats.activeTasks },
    { label: "Pend. cierre", value: pendingClosureCount },
    { label: "Finalizadas", value: stats.completedTasks },
  ]

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 gap-1.5 text-muted-foreground"
            asChild
          >
            <Link href="/obras">
              <ArrowLeft className="size-4" />
              Volver
            </Link>
          </Button>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="font-mono text-xs font-medium text-primary">
                {project.code}
              </p>
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {project.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {project.client}
                {project.location ? ` · ${project.location}` : ""}
              </p>
            </div>
            <ProjectStatusBadge status={project.status} />
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Inicio {formatDate(project.startDate)} → Fin{" "}
              {formatDate(project.endDate)}
            </span>
          </div>

          <div className="max-w-md space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">Progreso</span>
              <span className="tabular-nums text-muted-foreground">
                {project.progress}%
              </span>
            </div>
            <ProjectProgressBar value={project.progress} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:max-w-md lg:justify-end">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => onAction("view_planning")}
            disabled={isBusy}
          >
            <CalendarDays className="size-4" />
            Planificación
          </Button>

          {primaryActions.map((action) => (
            <Button
              key={action.id}
              size="sm"
              variant={action.variant ?? "default"}
              onClick={() => onAction(action.id)}
              disabled={isBusy}
            >
              {action.label}
            </Button>
          ))}

          {secondaryActions.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  Más
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {secondaryActions.map((action, index) => (
                  <div key={action.id}>
                    {action.variant === "destructive" && index > 0 ? (
                      <DropdownMenuSeparator />
                    ) : null}
                    <DropdownMenuItem
                      variant={
                        action.variant === "destructive"
                          ? "destructive"
                          : "default"
                      }
                      onClick={() => onAction(action.id)}
                      disabled={isBusy}
                    >
                      {action.label}
                    </DropdownMenuItem>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border bg-muted/15 px-3 py-2.5"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border bg-muted/10 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">Ubicación GPS</p>
          <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 size-3.5 shrink-0" />
            <span className="break-all">
              {gpsLabel ?? "GPS no configurado"}
            </span>
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 self-start sm:self-auto"
          onClick={onEditLocation}
          disabled={isBusy}
        >
          <Pencil className="size-3.5" />
          Editar ubicación
        </Button>
      </div>
    </div>
  )
}
