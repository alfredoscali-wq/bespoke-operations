"use client"

import { useMemo, useState } from "react"
import { Upload } from "lucide-react"

import { useProjects } from "@/components/obras/projects-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { EVIDENCE_WORKERS } from "@/lib/evidence/constants"
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

type EvidenceUploadDialogProps = {
  onSubmit: (input: UploadEvidenceInput) => Promise<{
    success: boolean
    message?: string
  }>
}

export function EvidenceUploadDialog({ onSubmit }: EvidenceUploadDialogProps) {
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

  const selectedProject = projects.find((project) => project.id === projectId)
  const tasksForProject = useMemo(
    () =>
      selectedProject
        ? tasks.filter((task) => task.projectCode === selectedProject.code)
        : [],
    [selectedProject, tasks]
  )
  const selectedTask = tasksForProject.find((task) => task.id === taskId)

  function resetForm() {
    setFile(null)
    setProjectId("")
    setTaskId("")
    setWorker(EVIDENCE_WORKERS[0])
    setDescription("")
    setCategory("Campo")
    setError(null)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (!file || !selectedProject || !selectedTask) {
      setError("Seleccione proyecto, tarea e imagen.")
      return
    }

    setSubmitting(true)
    setError(null)

    const result = await onSubmit({
      file,
      projectId: selectedProject.id,
      projectCode: selectedProject.code,
      projectName: selectedProject.name,
      taskId: selectedTask.id,
      taskCode: selectedTask.code,
      taskTitle: selectedTask.title,
      crew: selectedTask.crew,
      worker,
      description,
      category,
    })

    setSubmitting(false)

    if (!result.success) {
      setError(result.message ?? "No se pudo subir la evidencia.")
      return
    }

    resetForm()
    setOpen(false)
  }

  const isValid = file !== null && projectId !== "" && taskId !== "" && worker !== ""

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
            Cargue una imagen de campo vinculada a una obra y tarea.
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

          <div className="space-y-2">
            <Label>Proyecto</Label>
            <Select
              value={projectId}
              onValueChange={(value) => {
                setProjectId(value)
                setTaskId("")
              }}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Seleccionar proyecto" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tarea</Label>
            <Select
              value={taskId}
              onValueChange={setTaskId}
              disabled={!selectedProject}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Seleccionar tarea" />
              </SelectTrigger>
              <SelectContent>
                {tasksForProject.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    {task.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
