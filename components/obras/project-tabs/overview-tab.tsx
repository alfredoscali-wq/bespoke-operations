import { User } from "lucide-react"

import type { Project } from "@/lib/types/projects"
import { formatDate } from "@/lib/projects/constants"
import { ProjectStatusSummary } from "@/components/obras/project-status-summary"
import { ProjectEvidenceSummary } from "@/components/evidencias/project-evidence-summary"
import { ProjectMaterialsSummary } from "@/components/materiales/project-materials-summary"
import { ProjectTypeBadge } from "@/components/obras/project-badges"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type ProjectOverviewTabProps = {
  project: Project
}

export function ProjectOverviewTab({ project }: ProjectOverviewTabProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="shadow-sm lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Información general</CardTitle>
            <ProjectTypeBadge type={project.type} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {project.description?.trim() ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {project.description}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-muted/15 px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Supervisor
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {project.supervisor || "—"}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/15 px-3 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Fechas
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {formatDate(project.startDate)} → {formatDate(project.endDate)}
              </p>
            </div>
          </div>

          {project.client ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="size-3.5 shrink-0" />
              <span>{project.client}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <ProjectStatusSummary project={project} />
        <ProjectEvidenceSummary projectId={project.id} />
        <ProjectMaterialsSummary projectId={project.id} />
      </div>
    </div>
  )
}
