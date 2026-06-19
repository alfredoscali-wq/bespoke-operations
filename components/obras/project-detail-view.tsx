"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  MoreHorizontal,
} from "lucide-react"

import { useProjects } from "@/components/obras/projects-provider"
import { ProjectEditDialog } from "@/components/obras/project-edit-dialog"
import { ProjectPauseDialog } from "@/components/obras/project-pause-dialog"
import type { PauseProjectInput, Project, ProjectDetail } from "@/lib/types/projects"
import { getProjectActions } from "@/lib/projects/utils"
import { PROJECT_STATUS_LABELS } from "@/lib/projects/constants"
import { logDeleteTrace } from "@/lib/supabase/delete-trace"
import { ProjectDetailStats } from "@/components/obras/project-detail-stats"
import { ProjectOverviewTab } from "@/components/obras/project-tabs/overview-tab"
import { ProjectTasksTab } from "@/components/obras/project-tabs/tasks-tab"
import { ProjectEvidenceTab } from "@/components/obras/project-tabs/evidence-tab"
import { ProjectDocumentsTab } from "@/components/obras/project-tabs/documents-tab"
import { ProjectHistoryTab } from "@/components/obras/project-tabs/history-tab"
import { ProjectCostsTab } from "@/components/obras/project-tabs/costs-tab"
import { ProjectCrewsTab } from "@/components/obras/project-tabs/crews-tab"
import { ProjectMaterialsTab } from "@/components/obras/project-tabs/materials-tab"
import {
  ProjectStatusBadge,
  ProjectTypeBadge,
} from "@/components/obras/project-badges"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type ProjectDetailViewProps = {
  project: Project
  detail: ProjectDetail
}

export function ProjectDetailView({
  project: initialProject,
  detail: initialDetail,
}: ProjectDetailViewProps) {
  const router = useRouter()
  const {
    getProject,
    updateProject,
    transitionProjectStatus,
    pauseProject,
    resumeProject,
    finalizeProject,
    archiveProject,
    reopenProject,
    loadHistory,
    getHistory,
  } = useProjects()

  const project = getProject(initialProject.id) ?? initialProject
  const actions = getProjectActions(project.status)

  const [history, setHistory] = useState(initialDetail.history)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [pauseOpen, setPauseOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const loaded = await loadHistory(project.id)
      if (!cancelled) {
        setHistory(loaded.length > 0 ? loaded : getHistory(project.id))
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [project.id, loadHistory, getHistory])

  async function runAction(
    action: () => Promise<{ success: boolean; message?: string }>,
    successMessage: string
  ): Promise<boolean> {
    setError(null)
    setFeedback(null)
    setIsBusy(true)

    const result = await action()
    setIsBusy(false)

    if (!result.success) {
      setError(result.message ?? "No se pudo completar la acción.")
      return false
    }

    setFeedback(successMessage)
    const loaded = await loadHistory(project.id)
    setHistory(loaded)
    return true
  }

  async function handleEdit(form: {
    name: string
    code: string
    client: string
    type: Project["type"]
    location: string
    description: string
    startDate?: string
    endDate?: string
    supervisor: string
  }) {
    setIsBusy(true)
    const result = await updateProject(project.id, {
      name: form.name,
      code: form.code,
      client: form.client,
      type: form.type,
      location: form.location,
      description: form.description,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      supervisor: form.supervisor,
    })
    setIsBusy(false)

    if (!result.success) {
      setError(result.message ?? "No se pudo actualizar la obra.")
      return
    }

    setEditOpen(false)
    setFeedback("Obra actualizada correctamente.")
    const loaded = await loadHistory(project.id)
    setHistory(loaded)
  }

  async function handlePause(input: PauseProjectInput) {
    const success = await runAction(
      () => pauseProject(project.id, input),
      "Obra pausada correctamente."
    )
    if (success) {
      setPauseOpen(false)
    }
  }

  async function handleArchive() {
    logDeleteTrace("ui.project-detail-view.handleArchive", {
      entity: "project",
      id: project.id,
      code: project.code,
    })

    const success = await runAction(
      () => archiveProject(project.id),
      "Obra archivada correctamente."
    )

    if (!success) {
      return
    }

    setArchiveOpen(false)
    router.push("/obras")
  }

  function handleAction(actionId: (typeof actions)[number]["id"]) {
    switch (actionId) {
      case "edit":
        setEditOpen(true)
        break
      case "start":
        void runAction(
          () => transitionProjectStatus(project.id, "active"),
          `Obra actualizada a ${PROJECT_STATUS_LABELS.active}.`
        )
        break
      case "pause":
        setPauseOpen(true)
        break
      case "resume":
        void runAction(
          () => resumeProject(project.id),
          `Obra actualizada a ${PROJECT_STATUS_LABELS.active}.`
        )
        break
      case "finalize":
        void runAction(
          () => finalizeProject(project.id),
          `Obra actualizada a ${PROJECT_STATUS_LABELS.closed}.`
        )
        break
      case "archive":
        setArchiveOpen(true)
        break
      case "reopen":
        void runAction(
          () => reopenProject(project.id),
          `Obra actualizada a ${PROJECT_STATUS_LABELS.active}.`
        )
        break
      case "view_planning":
        router.push(`/operations/calendar?projectId=${project.id}`)
        break
    }
  }

  const primaryActions = actions.filter((action) =>
    ["start", "resume", "finalize", "reopen"].includes(action.id)
  )
  const secondaryActions = actions.filter(
    (action) =>
      !primaryActions.some((item) => item.id === action.id) &&
      action.id !== "view_planning"
  )

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
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => handleAction("view_planning")}
            disabled={isBusy}
          >
            <CalendarDays className="size-4" />
            Ver planificación
          </Button>

          {primaryActions.map((action) => (
            <Button
              key={action.id}
              size="sm"
              variant={action.variant ?? "default"}
              onClick={() => handleAction(action.id)}
              disabled={isBusy}
            >
              {action.label}
            </Button>
          ))}

          {secondaryActions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  Acciones
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {secondaryActions.map((action, index) => (
                  <div key={action.id}>
                    {action.variant === "destructive" && index > 0 && (
                      <DropdownMenuSeparator />
                    )}
                    <DropdownMenuItem
                      variant={
                        action.variant === "destructive"
                          ? "destructive"
                          : "default"
                      }
                      onClick={() => handleAction(action.id)}
                      disabled={isBusy}
                    >
                      {action.label}
                    </DropdownMenuItem>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {feedback && (
        <Alert>
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <ProjectDetailStats project={project} />

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList variant="line" className="w-full min-w-max justify-start">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="tasks">Tareas</TabsTrigger>
            <TabsTrigger value="crews">Cuadrillas</TabsTrigger>
            <TabsTrigger value="materials">Materiales</TabsTrigger>
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
        <TabsContent value="crews">
          <ProjectCrewsTab project={project} />
        </TabsContent>
        <TabsContent value="materials">
          <ProjectMaterialsTab projectId={project.id} />
        </TabsContent>
        <TabsContent value="evidence">
          <ProjectEvidenceTab project={project} />
        </TabsContent>
        <TabsContent value="documents">
          <ProjectDocumentsTab documents={initialDetail.documents} />
        </TabsContent>
        <TabsContent value="history">
          <ProjectHistoryTab history={history} />
        </TabsContent>
        <TabsContent value="costs">
          <ProjectCostsTab costs={initialDetail.costs} />
        </TabsContent>
      </Tabs>

      <ProjectEditDialog
        project={project}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSubmit={handleEdit}
        isSubmitting={isBusy}
      />

      <ProjectPauseDialog
        open={pauseOpen}
        onOpenChange={setPauseOpen}
        onConfirm={handlePause}
        isSubmitting={isBusy}
      />

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archivar obra</DialogTitle>
            <DialogDescription>
              La obra se ocultará de operaciones activas pero conservará su
              historial. Esta acción no elimina datos físicamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArchiveOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleArchive()}
              disabled={isBusy}
            >
              {isBusy ? "Archivando..." : "Archivar obra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
