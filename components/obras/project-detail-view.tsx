"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"

import { useProjects } from "@/components/obras/projects-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { ProjectEditDialog } from "@/components/obras/project-edit-dialog"
import { ProjectPauseDialog } from "@/components/obras/project-pause-dialog"
import type { PauseProjectInput, Project, ProjectDetail } from "@/lib/types/projects"
import { ProjectDetailOperationalHeader } from "@/components/obras/project-detail-operational-header"
import { getProjectActions } from "@/lib/projects/utils"
import {
  buildStartProjectDispatchHistoryDescription,
  validateStartProjectDispatch,
} from "@/lib/projects/project-start-dispatch"
import {
  buildFinalizeProjectHistoryDescription,
  validateFinalizeProject,
} from "@/lib/projects/project-finalize"
import { getTasksForProject } from "@/lib/tasks/utils"
import { PROJECT_STATUS_LABELS } from "@/lib/projects/constants"
import { ProjectOverviewTab } from "@/components/obras/project-tabs/overview-tab"
import { ProjectTasksTab } from "@/components/obras/project-tabs/tasks-tab"
import { ProjectEvidenceTab } from "@/components/obras/project-tabs/evidence-tab"
import { ProjectDocumentsTab } from "@/components/obras/project-tabs/documents-tab"
import { ProjectHistoryTab } from "@/components/obras/project-tabs/history-tab"
import { ProjectCostsTab } from "@/components/obras/project-tabs/costs-tab"
import { ProjectCrewsTab } from "@/components/obras/project-tabs/crews-tab"
import { ProjectMaterialsTab } from "@/components/obras/project-tabs/materials-tab"
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
    startProject,
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
  const { tasks, refreshTasksFromServer } = useTasks()

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
    latitude?: number | null
    longitude?: number | null
    sharedLocation?: string
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
      latitude: form.latitude ?? null,
      longitude: form.longitude ?? null,
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
      case "start": {
        const projectTasks = getTasksForProject(project, tasks)
        const validation = validateStartProjectDispatch({
          projectStatus: project.status,
          tasks: projectTasks,
          latitude: project.latitude,
          longitude: project.longitude,
        })

        if (!validation.ok) {
          setError(validation.message)
          setFeedback(null)
          return
        }

        void (async () => {
          setError(null)
          setFeedback(null)
          setIsBusy(true)

          const result = await startProject(project.id)
          setIsBusy(false)

          if (!result.success) {
            setError(result.message ?? "No se pudo completar la acción.")
            return
          }

          setFeedback(
            buildStartProjectDispatchHistoryDescription(
              result.dispatchedCount ?? validation.dispatchableTasks.length
            )
          )
          const loaded = await loadHistory(project.id)
          setHistory(loaded)
          await refreshTasksFromServer()
        })()
        break
      }
      case "pause":
        setPauseOpen(true)
        break
      case "resume":
        void runAction(
          () => resumeProject(project.id),
          `Obra actualizada a ${PROJECT_STATUS_LABELS.active}.`
        )
        break
      case "finalize": {
        const projectTasks = getTasksForProject(project, tasks)
        const validation = validateFinalizeProject({
          projectStatus: project.status,
          projectId: project.id,
          tasks: projectTasks,
        })

        if (!validation.ok) {
          setError(validation.message)
          setFeedback(null)
          return
        }

        void (async () => {
          setError(null)
          setFeedback(null)
          setIsBusy(true)

          const result = await finalizeProject(project.id)
          setIsBusy(false)

          if (!result.success) {
            setError(result.message ?? "No se pudo completar la acción.")
            return
          }

          setFeedback(
            buildFinalizeProjectHistoryDescription(
              project.status === "paused" ? "paused" : "active"
            )
          )
          const loaded = await loadHistory(project.id)
          setHistory(loaded)
        })()
        break
      }
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
    <div className="space-y-5">
      <ProjectDetailOperationalHeader
        project={project}
        tasks={tasks}
        isBusy={isBusy}
        primaryActions={primaryActions}
        secondaryActions={secondaryActions}
        onAction={handleAction}
        onEditLocation={() => setEditOpen(true)}
      />

      {feedback ? (
        <Alert>
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList variant="line" className="w-full min-w-max justify-start">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="tasks">Órdenes de Trabajo</TabsTrigger>
            <TabsTrigger value="evidence">Evidencias</TabsTrigger>
            <TabsTrigger value="history">Historial</TabsTrigger>
            <TabsTrigger value="crews">Cuadrillas</TabsTrigger>
            <TabsTrigger value="materials">Materiales</TabsTrigger>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
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
