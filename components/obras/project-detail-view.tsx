"use client"

import Link from "next/link"
import { ArrowLeft, MoreHorizontal } from "lucide-react"

import type { Project, ProjectDetail } from "@/lib/types/projects"
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

export function ProjectDetailView({ project, detail }: ProjectDetailViewProps) {
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 self-start">
              Acciones
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Editar obra</DropdownMenuItem>
            <DropdownMenuItem>Exportar expediente</DropdownMenuItem>
            <DropdownMenuItem>Cambiar estado</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ProjectDetailStats stats={detail.stats} />

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
          <ProjectEvidenceTab projectId={project.id} />
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
