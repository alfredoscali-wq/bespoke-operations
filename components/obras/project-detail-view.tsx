"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, MoreHorizontal } from "lucide-react"

import { useProjects } from "@/components/obras/projects-provider"
import type { Project, ProjectDetail } from "@/lib/types/projects"
import { getProjectLifecycleAction } from "@/lib/projects/utils"
import { PROJECT_STATUS_LABELS } from "@/lib/projects/constants"
import { ProjectDetailStats } from "@/components/obras/project-detail-stats"
import { ProjectOverviewTab } from "@/components/obras/project-tabs/overview-tab"
import { ProjectTasksTab } from "@/components/obras/project-tabs/tasks-tab"
import { ProjectEvidenceTab } from "@/components/obras/project-tabs/evidence-tab"
import { ProjectDocumentsTab } from "@/components/obras/project-tabs/documents-tab"
import { ProjectHistoryTab } from "@/components/obras/project-tabs/history-tab"
import { ProjectCostsTab } from "@/components/obras/project-tabs/costs-tab"
import {
  ProjectStatusBadge,
  ProjectTypeBadge,
} from "@/components/obras/project-badges"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type ProjectDetailViewProps = {
  project: Project
  detail: ProjectDetail
}

export function ProjectDetailView({ project: initialProject, detail }: ProjectDetailViewProps) {
  const { getProject, transitionProjectStatus } = useProjects()
  const project = getProject(initialProject.id) ?? initialProject
  const lifecycleAction = getProjectLifecycleAction(project.status)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null)

  async function handleLifecycleAction() {
    if (!lifecycleAction) return

    setStatusError(null)
    setStatusFeedback(null)
    setIsTransitioning(true)

    const result = await transitionProjectStatus(
      project.id,
      lifecycleAction.nextStatus
    )

    setIsTransitioning(false)

    if (!result.success) {
      setStatusError(result.message ?? "No se pudo actualizar el estado de la obra.")
      return
    }

    setStatusFeedback(
      `Obra actualizada a ${PROJECT_STATUS_LABELS[lifecycleAction.nextStatus]}.`
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 gap-1.5 text-muted-foreground"
            asChild
          >
            <Link href="/obras">
              <ArrowLeft className="size-4" />
              Volver a obras
            </Link>
          </Button>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-medium text-primary">
                {project.code}
              </span>
              <ProjectTypeBadge type={project.type} />
              <ProjectStatusBadge status={project.status} />
            </div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {project.name}
            </h2>
            <p className="text-sm text-muted-foreground">{project.client}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          {lifecycleAction && (
            <Button
              size="sm"
              onClick={handleLifecycleAction}
              disabled={isTransitioning}
            >
              {isTransitioning ? "Actualizando..." : lifecycleAction.label}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                Acciones
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>Editar obra</DropdownMenuItem>
              <DropdownMenuItem disabled>Exportar expediente</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {statusFeedback && (
        <Alert>
          <AlertDescription>{statusFeedback}</AlertDescription>
        </Alert>
      )}

      {statusError && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{statusError}</AlertDescription>
        </Alert>
      )}

      <ProjectDetailStats project={project} />

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList variant="line" className="w-full min-w-max justify-start">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="tasks">Tareas</TabsTrigger>
            <TabsTrigger value="evidence">Evidencias</TabsTrigger>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
            <TabsTrigger value="costs">Costos</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <ProjectOverviewTab project={project} />
        </TabsContent>
        <TabsContent value="tasks">
          <ProjectTasksTab project={project} />
        </TabsContent>
        <TabsContent value="evidence">
          <ProjectEvidenceTab project={project} />
        </TabsContent>
        <TabsContent value="documents">
          <ProjectDocumentsTab documents={detail.documents} />
        </TabsContent>
        <TabsContent value="history">
          <ProjectHistoryTab history={detail.history} />
        </TabsContent>
        <TabsContent value="costs">
          <ProjectCostsTab costs={detail.costs} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
