"use client"

import { useEffect, useMemo, useState } from "react"
import { Upload } from "lucide-react"

import { useProjects } from "@/components/obras/projects-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { EVIDENCE_WORKERS } from "@/lib/evidence/constants"
import type { EvidenceUploadOrigin } from "@/lib/evidence/upload-origin"
import { getTasksForProject } from "@/lib/tasks/utils"
import type { UploadEvidenceInput } from "@/lib/types/supabase/evidences"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const PROJECT_ONLY_TASK_VALUE = "__project_only__"

type EvidenceUploadProjectContext = {
  id?: string | null
  code: string
  name: string
}

type EvidenceUploadTaskContext = {
  id: string
  code: string
  title: string
  crew: string
}

type EvidenceUploadDialogProps = {
  onSubmit: (input: UploadEvidenceInput) => Promise<{
    success: boolean
    message?: string
  }>
  project?: EvidenceUploadProjectContext
  task?: EvidenceUploadTaskContext
  allowProjectOnly?: boolean
  origin?: EvidenceUploadOrigin
  onUploaded?: () => void
}

export function EvidenceUploadDialog({
  onSubmit,
  project: lockedProject,
  task: lockedTask,
  allowProjectOnly = false,
  origin = "dashboard",
  onUploaded,
}: EvidenceUploadDialogProps) {
  const { projects } = useProjects()
  const { tasks } = useTasks()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [projectId, setProjectId] = useState("")
  const [taskId, setTaskId] = useState("")
  const [worker, setWorker] = useState<string>(EVIDENCE_WORKERS[0])
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("Campo")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isProjectLocked = Boolean(lockedProject)
  const isTaskLocked = Boolean(lockedTask)

  const selectedProject = useMemo(() => {
    if (lockedProject) {
      return {
        id: lockedProject.id ?? null,
        code: lockedProject.code,
        name: lockedProject.name,
      }
    }

    return projects.find((project) => project.id === projectId)
  }, [lockedProject, projects, projectId])

  const tasksForProject = useMemo(() => {
    if (!selectedProject) return []

    if (lockedProject) {
      return getTasksForProject(
        {
          id: lockedProject.id ?? "",
          code: lockedProject.code,
          name: lockedProject.name,
        } as Parameters<typeof getTasksForProject>[0],
        tasks
      )
    }

    const project = projects.find((item) => item.id === projectId)
    return project ? getTasksForProject(project, tasks) : []
  }, [lockedProject, selectedProject, projectId, projects, tasks])

  const selectedTask = useMemo(() => {
    if (lockedTask) return lockedTask
    if (taskId === PROJECT_ONLY_TASK_VALUE) return null
    return tasksForProject.find((task) => task.id === taskId)
  }, [lockedTask, taskId, tasksForProject])

  const showTaskSelector =
    !isTaskLocked &&
    Boolean(selectedProject) &&
    (tasksForProject.length > 0 || !allowProjectOnly)

  const projectOnlyMode =
    allowProjectOnly &&
    !isTaskLocked &&
    (tasksForProject.length === 0 || taskId === PROJECT_ONLY_TASK_VALUE)

  useEffect(() => {
    if (!open) return

    if (lockedProject) {
      setProjectId(lockedProject.id ?? "")
    }

    if (lockedTask) {
      setTaskId(lockedTask.id)
      return
    }

    if (allowProjectOnly && tasksForProject.length === 0) {
      setTaskId(PROJECT_ONLY_TASK_VALUE)
    }
  }, [open, lockedProject, lockedTask, allowProjectOnly, tasksForProject.length])

  function resetForm() {
    setFile(null)
    setProjectId(lockedProject?.id ?? "")
    setTaskId(
      lockedTask?.id ??
        (allowProjectOnly && tasksForProject.length === 0
          ? PROJECT_ONLY_TASK_VALUE
          : "")
    )
    setWorker(EVIDENCE_WORKERS[0])
    setDescription("")
    setCategory("Campo")
    setError(null)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (!file || !selectedProject) {
      setError("Seleccione una imagen y confirme la obra.")
      return
    }

    if (!allowProjectOnly && !selectedTask) {
      setError("Seleccione una tarea.")
      return
    }

    if (
      allowProjectOnly &&
      tasksForProject.length > 0 &&
      !selectedTask &&
      taskId !== PROJECT_ONLY_TASK_VALUE
    ) {
      setError("Seleccione una tarea o suba la evidencia solo a la obra.")
      return
    }

    setSubmitting(true)
    setError(null)

    const result = await onSubmit({
      file,
      projectId: selectedProject.id,
      projectCode: selectedProject.code,
      projectName: selectedProject.name,
      taskId: selectedTask?.id ?? null,
      taskCode: selectedTask?.code,
      taskTitle: selectedTask?.title,
      crew: selectedTask?.crew,
      worker,
      description,
      category,
      origin,
    })

    setSubmitting(false)

    if (!result.success) {
      setError(result.message ?? "No se pudo subir la evidencia.")
      return
    }

    resetForm()
    setOpen(false)
    onUploaded?.()
  }

  const isValid =
    file !== null &&
    selectedProject !== undefined &&
    worker !== "" &&
    (isTaskLocked ||
      projectOnlyMode ||
      selectedTask !== undefined ||
      (!allowProjectOnly && taskId !== ""))

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) resetForm()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Upload className="size-4" />
          Subir evidencia
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Subir evidencia</DialogTitle>
          <DialogDescription>
            {isTaskLocked
              ? "Cargue una imagen vinculada a la tarea seleccionada."
              : isProjectLocked
                ? "Cargue una imagen vinculada a esta obra."
                : "Cargue una imagen de campo vinculada a una obra y tarea existentes."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="evidence-file">Imagen</Label>
            <Input
              id="evidence-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              className="bg-background"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null)
              }}
            />
          </div>

          {isProjectLocked && selectedProject ? (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Obra
              </p>
              <p className="font-medium">
                {selectedProject.code} — {selectedProject.name}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Obra</Label>
              <Select
                value={projectId}
                onValueChange={(value) => {
                  setProjectId(value)
                  setTaskId("")
                }}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Seleccionar obra" />
                </SelectTrigger>
                <SelectContent>
                  {projects.length === 0 ? (
                    <SelectItem value="__empty" disabled>
                      No hay obras registradas
                    </SelectItem>
                  ) : (
                    projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.code} — {project.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {isTaskLocked && lockedTask ? (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tarea
              </p>
              <p className="font-medium">
                {lockedTask.code} — {lockedTask.title}
              </p>
            </div>
          ) : showTaskSelector ? (
            <div className="space-y-2">
              <Label>Tarea</Label>
              <Select value={taskId} onValueChange={setTaskId}>
                <SelectTrigger className="bg-background">
                  <SelectValue
                    placeholder={
                      tasksForProject.length === 0
                        ? "Sin tareas para esta obra"
                        : "Seleccionar tarea"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {allowProjectOnly && (
                    <SelectItem value={PROJECT_ONLY_TASK_VALUE}>
                      Solo obra (sin tarea)
                    </SelectItem>
                  )}
                  {tasksForProject.map((task) => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.code} — {task.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : projectOnlyMode ? (
            <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              Esta evidencia quedará vinculada solo a la obra.
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Operario</Label>
            <Select value={worker} onValueChange={setWorker}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Seleccionar operario" />
              </SelectTrigger>
              <SelectContent>
                {EVIDENCE_WORKERS.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="evidence-category">Categoría</Label>
            <Input
              id="evidence-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="evidence-description">Descripción</Label>
            <Textarea
              id="evidence-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="bg-background"
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={!isValid || submitting}>
              {submitting ? "Subiendo..." : "Subir evidencia"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
