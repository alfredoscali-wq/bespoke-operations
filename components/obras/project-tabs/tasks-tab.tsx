"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Eye, MoreHorizontal, Pencil, Plus, Trash2, ClipboardCheck } from "lucide-react"

import { useTasks } from "@/components/tareas/tasks-provider"
import { TASK_DELETE_USER_MESSAGE } from "@/lib/operations/user-messages"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { TaskCrewAssignmentCell } from "@/components/obras/task-crew-assignment-cell"
import { ProjectTaskDialog } from "@/components/obras/project-task-dialog"
import { mergeTaskMetadataWithTemplate } from "@/lib/tasks/operational-checklist-template"
import type { OperationalChecklistTemplateItem } from "@/lib/tasks/operational-checklist-template"
import {
  TaskPriorityBadge,
  TaskStatusBadge,
} from "@/components/tareas/task-badges"
import type { Project } from "@/lib/types/projects"
import type { Task } from "@/lib/types/tasks"
import { formatTaskDate } from "@/lib/tasks/constants"
import { getTaskStatusSurfaceClass } from "@/lib/tasks/status-visual"
import { compareDateOnly } from "@/lib/dates/date-only"
import {
  canEditProjectTaskFromObras,
  resolveProjectTaskCreateStatus,
} from "@/lib/projects/project-start-dispatch"
import { resolveProjectTaskRowActions } from "@/lib/projects/project-task-row-actions"
import { ProjectTaskClosureReviewSheet } from "@/components/obras/project-task-closure-review-sheet"
import { getTasksForProject } from "@/lib/tasks/utils"
import { resolveCrewSnapshotsForAssignment, isTaskCrewArchived } from "@/lib/tasks/crew-relation"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  const { getCrew } = useCrews()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode>("create")
  const [selectedTask, setSelectedTask] = useState<Task | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)
  const [closureReviewTaskId, setClosureReviewTaskId] = useState<string | null>(
    null
  )
  const [isDeleting, setIsDeleting] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const projectTasks = useMemo(
    () =>
      getTasksForProject(project, tasks).sort((a, b) =>
        compareDateOnly(a.dueDate, b.dueDate)
      ),
    [project, tasks]
  )

  const archivedCrewTaskCount = useMemo(
    () => projectTasks.filter((task) => isTaskCrewArchived(task, getCrew)).length,
    [projectTasks, getCrew]
  )

  function openCreateDialog() {
    setDialogMode("create")
    setSelectedTask(undefined)
    setDialogOpen(true)
  }

  function openEditDialog(task: Task) {
    if (!canEditProjectTaskFromObras(task)) {
      setFeedback({
        type: "error",
        message:
          "Esta tarea ya inició su ejecución y no puede editarse libremente desde Obras.",
      })
      return
    }

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
    crewId: string
    crew: string
    startDate: string
    dueDate: string
    estimatedDuration: string
    operationalChecklistTemplate: OperationalChecklistTemplateItem[]
  }) {
    if (dialogMode === "edit" && selectedTask) {
      if (!canEditProjectTaskFromObras(selectedTask)) {
        throw new Error(
          "Esta tarea ya inició su ejecución y no puede editarse libremente desde Obras."
        )
      }

      const selectedCrew = getCrew(payload.crewId)
      const snapshots = resolveCrewSnapshotsForAssignment(selectedCrew)

      const result = await editTask(selectedTask.id, {
        title: payload.title,
        description: payload.description,
        priority: payload.priority,
        dueDate: payload.dueDate,
        startDate: payload.startDate,
        supervisor: payload.supervisor || snapshots.supervisor,
        crewId: snapshots.crewId,
        crew: snapshots.crew || payload.crew,
        estimatedDuration: payload.estimatedDuration,
        taskMetadata: mergeTaskMetadataWithTemplate(
          selectedTask,
          payload.operationalChecklistTemplate
        ),
      })

      if (!result.success) {
        throw new Error(result.message ?? "No se pudo actualizar la orden de trabajo.")
      }

      setFeedback({
        type: "success",
        message: "Orden de trabajo actualizada correctamente.",
      })
      return
    }

    const selectedCrew = getCrew(payload.crewId)
    const snapshots = resolveCrewSnapshotsForAssignment(selectedCrew)

    await addTask({
      code: payload.code,
      title: payload.title,
      description: payload.description,
      projectId: project.id,
      projectCode: project.code,
      projectName: project.name,
      type: payload.type,
      priority: payload.priority,
      supervisor: payload.supervisor || snapshots.supervisor,
      crewId: snapshots.crewId ?? undefined,
      crew: snapshots.crew || payload.crew,
      startDate: payload.startDate,
      dueDate: payload.dueDate,
      estimatedDuration: payload.estimatedDuration,
      checklist: [],
      taskMetadata: mergeTaskMetadataWithTemplate(
        {},
        payload.operationalChecklistTemplate
      ),
      status: resolveProjectTaskCreateStatus(project.status),
    })

    setFeedback({
      type: "success",
      message: "Orden de trabajo creada correctamente.",
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
        message: result.message ?? TASK_DELETE_USER_MESSAGE,
      })
      return
    }

    setDeleteTarget(null)
    setFeedback({
      type: "success",
      message: "Orden de trabajo eliminada correctamente.",
    })
  }

  function renderActions(task: Task) {
    const actions = resolveProjectTaskRowActions(task)

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Acciones</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.showReviewClosure ? (
            <DropdownMenuItem onClick={() => setClosureReviewTaskId(task.id)}>
              <ClipboardCheck className="size-4" />
              Revisar cierre
            </DropdownMenuItem>
          ) : null}
          {actions.showView ? (
            <DropdownMenuItem asChild>
              <Link href={`/tareas/${task.id}`}>
                <Eye className="size-4" />
                Ver
              </Link>
            </DropdownMenuItem>
          ) : null}
          {actions.showEdit ? (
            <DropdownMenuItem onClick={() => openEditDialog(task)}>
              <Pencil className="size-4" />
              Editar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled>
              <Pencil className="size-4" />
              Editar
            </DropdownMenuItem>
          )}
          {actions.showDelete ? (
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteTarget(task)}
            >
              <Trash2 className="size-4" />
              Eliminar
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Órdenes de trabajo de la obra</h3>
          <p className="text-xs text-muted-foreground">
            {projectTasks.length}{" "}
            {projectTasks.length === 1 ? "orden de trabajo registrada" : "órdenes de trabajo registradas"}
          </p>
        </div>
        <Button size="sm" className="gap-1.5 self-start" onClick={openCreateDialog}>
          <Plus className="size-4" />
          Nueva Orden de Trabajo
        </Button>
      </div>

      {archivedCrewTaskCount > 0 && (
        <Alert className="border-amber-200 bg-amber-50/80 text-amber-900">
          <AlertTriangle className="size-4 text-amber-700" />
          <AlertDescription>
            {archivedCrewTaskCount === 1
              ? "1 orden de trabajo referencia una cuadrilla archivada."
              : `${archivedCrewTaskCount} órdenes de trabajo referencian cuadrillas archivadas.`}{" "}
            Edite la orden de trabajo y reasigne una cuadrilla activa para corregir la
            inconsistencia operativa.
          </AlertDescription>
        </Alert>
      )}

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
              No hay órdenes de trabajo registradas para esta obra.
            </p>
            <Button size="sm" className="gap-1.5" onClick={openCreateDialog}>
              <Plus className="size-4" />
              Nueva Orden de Trabajo
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
                  <TableHead>Orden de trabajo</TableHead>
                  <TableHead>Cuadrilla</TableHead>
                  <TableHead>Fecha límite</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectTasks.map((task) => (
                  <TableRow
                    key={task.id}
                    className={getTaskStatusSurfaceClass(task.status)}
                  >
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
                    <TableCell>
                      <TaskCrewAssignmentCell task={task} getCrew={getCrew} />
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
              <Card
                key={task.id}
                size="sm"
                className={getTaskStatusSurfaceClass(task.status, {
                  accent: false,
                  ring: true,
                })}
              >
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
                      <CardDescription>
                        <TaskCrewAssignmentCell
                          task={task}
                          getCrew={getCrew}
                          compact
                        />
                      </CardDescription>
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

      <ProjectTaskClosureReviewSheet
        open={closureReviewTaskId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setClosureReviewTaskId(null)
          }
        }}
        taskId={closureReviewTaskId}
      />

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar Orden de Trabajo</DialogTitle>
            <DialogDescription>
              ¿Desea eliminar esta orden de trabajo?
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
