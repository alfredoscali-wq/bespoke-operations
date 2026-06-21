"use client"

import Link from "next/link"

import { ProjectHealthBadge } from "@/components/obras/project-health-badge"
import { ProjectOperationalCategoryBadge } from "@/components/obras/project-operational-badge"
import { ProjectProgressBar } from "@/components/obras/project-progress-bar"
import { useProjectsUI } from "@/components/obras/projects-ui-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import {
  formatProjectOperationalCode,
  OPERATIONAL_PROJECT_CATEGORY_KPI_LABELS,
  resolveProjectLocationLabel,
  resolveProjectPrimaryCrewLabel,
  resolveProjectTargetDateLabel,
} from "@/lib/projects/operational-project-category"
import type { Project } from "@/lib/types/projects"

type ProjectsOperationalListProps = {
  projects: Project[]
}

export function ProjectsOperationalList({ projects }: ProjectsOperationalListProps) {
  const { tasks } = useTasks()
  const { crews } = useCrews()
  const { selectedCategory, metricsByProjectId } = useProjectsUI()

  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          No se encontraron obras
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {selectedCategory
            ? `No hay obras en ${OPERATIONAL_PROJECT_CATEGORY_KPI_LABELS[selectedCategory].toLowerCase()}.`
            : "Ajusta los filtros para ver más resultados."}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {projects.map((project) => {
        const metrics = metricsByProjectId.get(project.id)

        if (!metrics) {
          return null
        }

        return (
          <article
            key={project.id}
            className="rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/20"
          >
            <Link href={`/obras/${project.id}`} className="block space-y-3">
              <h3 className="text-base font-semibold text-foreground">
                {project.name}
              </h3>

              <div className="flex flex-wrap items-center gap-2">
                <ProjectOperationalCategoryBadge project={project} tasks={tasks} />
                <ProjectHealthBadge health={metrics.health} />
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Avance</p>
                <ProjectProgressBar value={metrics.progress} />
              </div>

              <p className="text-sm text-foreground">
                {metrics.completedTasks}{" "}
                {metrics.completedTasks === 1 ? "completada" : "completadas"}
                {" · "}
                {metrics.pendingTasks}{" "}
                {metrics.pendingTasks === 1 ? "pendiente" : "pendientes"}
              </p>

              {metrics.overdueTasks > 0 ? (
                <p className="text-xs text-amber-800">
                  ⚠ {metrics.overdueTasks}{" "}
                  {metrics.overdueTasks === 1
                    ? "tarea vencida"
                    : "tareas vencidas"}
                </p>
              ) : null}

              <div className="space-y-1 text-sm text-muted-foreground">
                <p>{resolveProjectLocationLabel(project)}</p>
              </div>

              <div className="space-y-1 text-sm text-foreground">
                <p>{resolveProjectPrimaryCrewLabel(project, tasks, crews)}</p>
                <p>{resolveProjectTargetDateLabel(project)}</p>
              </div>

              <p className="font-mono text-[11px] text-muted-foreground/80">
                {formatProjectOperationalCode(project.code)}
              </p>
            </Link>
          </article>
        )
      })}
    </div>
  )
}
