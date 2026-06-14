import {
  Calendar,
  FileText,
  MapPin,
  User,
} from "lucide-react"

import type { Project } from "@/lib/types/projects"
import { formatDate } from "@/lib/projects/constants"
import { ProjectEvidenceSummary } from "@/components/evidencias/project-evidence-summary"
import { ProjectMaterialsSummary } from "@/components/materiales/project-materials-summary"
import { Progress } from "@/components/ui/progress"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ProjectStatusBadge,
  ProjectTypeBadge,
} from "@/components/obras/project-badges"

type ProjectOverviewTabProps = {
  project: Project
}

export function ProjectOverviewTab({ project }: ProjectOverviewTabProps) {
  const infoItems = [
    { icon: User, label: "Cliente", value: project.client },
    { icon: MapPin, label: "Ubicación", value: project.location },
    { icon: User, label: "Supervisor", value: project.supervisor },
    {
      icon: Calendar,
      label: "Fecha de inicio",
      value: formatDate(project.startDate),
    },
    {
      icon: Calendar,
      label: "Fecha estimada de fin",
      value: formatDate(project.endDate),
    },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="shadow-sm lg:col-span-2">
        <CardHeader>
          <CardTitle>Información del proyecto</CardTitle>
          <CardDescription>
            Datos generales y alcance de la obra
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <ProjectTypeBadge type={project.type} />
            <ProjectStatusBadge status={project.status} />
          </div>

          <p className="text-sm leading-relaxed text-muted-foreground">
            {project.description}
          </p>

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
                    <p className="text-sm font-medium text-foreground">
                      {item.value}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Avance general</CardTitle>
            <CardDescription>Progreso acumulado de la obra</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <span className="text-4xl font-semibold tracking-tight tabular-nums">
                {project.progress}%
              </span>
              <ProjectStatusBadge status={project.status} />
            </div>
            <Progress value={project.progress} className="h-2.5" />
            <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <FileText className="size-3.5" />
                {project.code}
              </div>
              <p className="mt-2 leading-relaxed">
                Seguimiento basado en tareas completadas, evidencias cargadas y
                hitos de campo reportados por la cuadrilla asignada.
              </p>
            </div>
          </CardContent>
        </Card>

        <ProjectEvidenceSummary projectId={project.id} />
        <ProjectMaterialsSummary projectId={project.id} />
      </div>
    </div>
  )
}
