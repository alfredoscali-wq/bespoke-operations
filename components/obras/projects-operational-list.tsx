"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { ProjectStatusBadge } from "@/components/obras/project-badges"
import { ProjectProgressBar } from "@/components/obras/project-progress-bar"
import { useProjectsUI } from "@/components/obras/projects-ui-provider"
import { formatDate } from "@/lib/projects/constants"
import { resolveProjectLocationLabel } from "@/lib/projects/operational-project-category"
import type { Project } from "@/lib/types/projects"
import { Button } from "@/components/ui/button"

type ProjectsOperationalListProps = {
  projects: Project[]
}

export function ProjectsOperationalList({ projects }: ProjectsOperationalListProps) {
  const { metricsByProjectId } = useProjectsUI()

  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/15 px-4 py-10 text-center">
        <p className="text-sm font-medium text-foreground">
          No se encontraron obras
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Ajuste la búsqueda o los filtros.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => {
        const metrics = metricsByProjectId.get(project.id)

        if (!metrics) {
          return null
        }

        const dateRange = [
          formatDate(project.startDate),
          formatDate(project.endDate),
        ]
          .filter(Boolean)
          .join(" → ")

        return (
          <article
            key={project.id}
            className="flex flex-col rounded-lg border bg-card p-3.5 shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/10"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-foreground">
                  {project.name}
                </h3>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {project.client}
                  {project.location
                    ? ` · ${resolveProjectLocationLabel(project)}`
                    : ""}
                </p>
              </div>
              <ProjectStatusBadge
                status={project.status}
                className="shrink-0 text-[10px]"
              />
            </div>

            {dateRange ? (
              <p className="mt-2.5 text-xs text-muted-foreground">{dateRange}</p>
            ) : null}

            <div className="mt-2">
              <ProjectProgressBar value={metrics.progress} />
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              OT · {metrics.pendingTasks} activas · {metrics.completedTasks}{" "}
              completadas
            </p>

            {metrics.overdueTasks > 0 ? (
              <p className="mt-1 text-[11px] font-medium text-amber-800">
                {metrics.overdueTasks} OT vencida
                {metrics.overdueTasks === 1 ? "" : "s"}
              </p>
            ) : null}

            <div className="mt-3 flex justify-end border-t border-border/60 pt-2.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1 px-2 text-xs"
                asChild
              >
                <Link href={`/obras/${project.id}`}>
                  Ver detalle
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </article>
        )
      })}
    </div>
  )
}
