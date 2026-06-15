"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"

import { useTasks } from "@/components/tareas/tasks-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import {
  defaultChecklist,
  ProjectTaskDialog,
} from "@/components/obras/project-task-dialog"
import {
  TaskPriorityBadge,
  TaskStatusBadge,
} from "@/components/tareas/task-badges"
import type { Project } from "@/lib/types/projects"
import type { Task } from "@/lib/types/tasks"
import { formatTaskDate } from "@/lib/tasks/constants"
import { getTasksForProject } from "@/lib/tasks/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ProjectTasksTabProps = {
  project: Project
}

type DialogMode = "create" | "edit"

export function ProjectTasksTab({ project }: ProjectTasksTabProps) {
  const { tasks, addTask, editTask, deleteTask } = useTasks()
  const { crews } = useCrews()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode>("create")
  const [selectedTask, setSelectedTask] = useState<Task | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const projectTasks = useMemo(
    () =>
      getTasksForProject(project, tasks).sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      ),
    [project, tasks]
  )

  function openCreateDialog() {
    setDialogMode("create")
    setSelectedTask(undefined)
    setDialogOpen(true)
  }

  function openEditDialog(task: Task) {
    setDialogMode("edit")
    setSelectedTask(task)
    setDialogOpen(true)
  }

  async function handleCreateOrEdit(payload: {
    code: string
    title: string
    description: string
    type: Task["type"]
    priority: Task["priority"]
    supervisor: string
    crew: string
    startDate: string
    dueDate: string
    estimatedDuration: string
  }) {
    if (dialogMode === "edit" && selectedTask) {
      const selectedCrew = crews.find((crew) => crew.name === payload.crew)

      const result = await editTask(selectedTask.id, {
        title: payload.title,
        description: payload.description,
        priority: payload.priority,
        dueDate: payload.dueDate,
        startDate: payload.startDate,
        supervisor: payload.supervisor,
        crewId: selectedCrew?.id ?? null,
        crew: payload.crew,
        estimatedDuration: payload.estimatedDuration,
      })

      if (!result.success) {
        throw new Error(result.message ?? "No se pudo actualizar la tarea.")
      }

      setFeedback({
        type: "success",
        message: "Tarea actualizada correctamente.",
      })
      return
    }

    const selectedCrew = crews.find((crew) => crew.name === payload.crew)

    await addTask({
      code: payload.code,
      title: payload.title,
      description: payload.description,
      projectId: project.id,
      projectCode: project.code,
      projectName: project.name,
      type: payload.type,
      priority: payload.priority,
      supervisor: payload.supervisor,
      crewId: selectedCrew?.id,
      crew: payload.crew,
      startDate: payload.startDate,
      dueDate: payload.dueDate,
      estimatedDuration: payload.estimatedDuration,
      checklist: defaultChecklist,
    })

    setFeedback({
      type: "success",
      message: "Tarea creada correctamente.",
    })
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return

    setIsDeleting(true)

    const result = await deleteTask(deleteTarget.id)

    setIsDeleting(false)

    if (!result.success) {
      setFeedback({
        type: "error",
        message: result.message ?? "No se pudo eliminar la tarea.",
      })
      return
    }

    setDeleteTarget(null)
    setFeedback({
      type: "success",
      message: "Tarea eliminada correctamente.",
    })
  }

  function renderActions(task: Task) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Acciones</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openEditDialog(task)}>
            <Pencil className="size-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteTarget(task)}
          >
            <Trash2 className="size-4" />
            Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Tareas de la obra</h3>
          <p className="text-xs text-muted-foreground">
            {projectTasks.length}{" "}
            {projectTasks.length === 1 ? "tarea registrada" : "tareas registradas"}
          </p>
        </div>
        <Button size="sm" className="gap-1.5 self-start" onClick={openCreateDialog}>
          <Plus className="size-4" />
          Nueva tarea
        </Button>
      </div>

      {feedback && (
        <p
          className={
            feedback.type === "success"
              ? "text-sm text-emerald-700"
              : "text-sm text-destructive"
          }
          role="status"
        >
          {feedback.message}
        </p>
      )}

      {projectTasks.length === 0 ? (
        <Card className="border-dashed shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No hay tareas registradas para esta obra.
            </p>
            <Button size="sm" className="gap-1.5" onClick={openCreateDialog}>
              <Plus className="size-4" />
              Nueva tarea
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border bg-card shadow-sm lg:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[100px]">Código</TableHead>
                  <TableHead>Tarea</TableHead>
                  <TableHead>Cuadrilla</TableHead>
                  <TableHead>Fecha límite</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-mono text-xs font-medium">
                      {task.code}
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/tareas/${task.id}`}
                        className="hover:text-primary"
                      >
                        {task.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {task.crew}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatTaskDate(task.dueDate)}
                    </TableCell>
                    <TableCell>
                      <TaskPriorityBadge priority={task.priority} />
                    </TableCell>
                    <TableCell>
                      <TaskStatusBadge status={task.status} />
                    </TableCell>
                    <TableCell>{renderActions(task)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 lg:hidden">
            {projectTasks.map((task) => (
              <Card key={task.id} size="sm" className="shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <p className="font-mono text-xs font-medium text-primary">
                        {task.code}
                      </p>
                      <CardTitle className="text-sm leading-snug">
                        <Link href={`/tareas/${task.id}`} className="hover:text-primary">
                          {task.title}
                        </Link>
                      </CardTitle>
                      <CardDescription>{task.crew}</CardDescription>
                    </div>
                    {renderActions(task)}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-2">
                  <TaskPriorityBadge priority={task.priority} />
                  <TaskStatusBadge status={task.status} />
                  <span className="text-xs text-muted-foreground">
                    {formatTaskDate(task.dueDate)}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <ProjectTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        project={project}
        task={selectedTask}
        existingTasks={tasks}
        onSubmit={handleCreateOrEdit}
      />

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar tarea</DialogTitle>
            <DialogDescription>
              ¿Desea eliminar esta tarea?
              {deleteTarget ? (
                <>
                  {" "}
                  <span className="font-medium text-foreground">
                    {deleteTarget.code} — {deleteTarget.title}
                  </span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
