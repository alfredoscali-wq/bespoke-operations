"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  CalendarClock,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  ClipboardCheck,
} from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { TASK_DELETE_USER_MESSAGE } from "@/lib/operations/user-messages"
import { ForceDeleteAction } from "@/components/admin/force-delete-action"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { TaskCrewAssignmentCell } from "@/components/obras/task-crew-assignment-cell"
import { ProjectTaskDialog } from "@/components/obras/project-task-dialog"
import { ProjectTaskRescheduleDialog } from "@/components/obras/project-task-reschedule-dialog"
import {
  mergeTaskMetadataWithTemplate,
  readOperationalChecklistTemplate,
  type OperationalChecklistTemplateItem,
} from "@/lib/tasks/operational-checklist-template"
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
import { canRescheduleProjectTaskFromSession } from "@/lib/projects/project-task-reschedule"
import { resolveProjectTaskRowActions } from "@/lib/projects/project-task-row-actions"
import { ProjectTaskClosureReviewSheet } from "@/components/obras/project-task-closure-review-sheet"
import { getTasksForProject } from "@/lib/tasks/utils"
import { resolveCrewSnapshotsForAssignment, isTaskCrewArchived } from "@/lib/tasks/crew-relation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
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

type ProjectTasksTabProps = {
  project: Project
}

type DialogMode = "create" | "edit"

export function ProjectTasksTab({ project }: ProjectTasksTabProps) {
  const { sessionUser } = useAuth()
  const {
    tasks,
    addTask,
    editTask,
    deleteTask,
    removeTaskLocally,
    rescheduleProjectTask,
  } = useTasks()
  const { getCrew } = useCrews()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode>("create")
  const [selectedTask, setSelectedTask] = useState<Task | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)
  const [rescheduleTarget, setRescheduleTarget] = useState<Task | null>(null)
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [closureReviewTaskId, setClosureReviewTaskId] = useState<string | null>(
    null
  )
  const [isDeleting, setIsDeleting] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const actorName =
    sessionUser?.displayName?.trim() ||
    sessionUser?.email?.trim() ||
    "Usuario"

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
    observationsForCrew: string
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
        observationsForCrew: payload.observationsForCrew,
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
      observationsForCrew: payload.observationsForCrew,
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

  function openRescheduleDialog(task: Task) {
    if (!canRescheduleProjectTaskFromSession(sessionUser, task)) {
      setFeedback({
        type: "error",
        message:
          "No tiene permisos para reprogramar esta orden de trabajo o su estado no lo permite.",
      })
      return
    }

    setRescheduleTarget(task)
  }

  async function handleRescheduleConfirm(input: {
    dueDate: string
    scheduledTime: string
    reason: string
    notes?: string
    rescheduledBy: string
  }) {
    if (!rescheduleTarget) return

    setIsRescheduling(true)
    const result = await rescheduleProjectTask(rescheduleTarget.id, {
      ...input,
      actor: actorName,
    })
    setIsRescheduling(false)

    if (!result.success) {
      setFeedback({
        type: "error",
        message: result.message ?? "No se pudo reprogramar la orden de trabajo.",
      })
      return
    }

    setRescheduleTarget(null)
    setFeedback({
      type: "success",
      message: "OT reprogramada correctamente.",
    })
  }

  function renderActions(task: Task) {
    const actions = resolveProjectTaskRowActions(task)
    const showReschedule = canRescheduleProjectTaskFromSession(
      sessionUser,
      task
    )

    return (
      <div className="flex shrink-0 items-center gap-1">
        {actions.showReviewClosure ? (
          <Button
            size="sm"
            className="h-8 gap-1 px-2.5 text-xs"
            onClick={() => setClosureReviewTaskId(task.id)}
          >
            <ClipboardCheck className="size-3.5" />
            Revisar cierre
          </Button>
        ) : null}
        {showReschedule ? (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 px-2.5 text-xs"
            onClick={() => openRescheduleDialog(task)}
          >
            <CalendarClock className="size-3.5" />
            Reprogramar OT
          </Button>
        ) : null}
        <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Acciones</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {actions.showView ? (
            <DropdownMenuItem asChild>
              <Link href={`/tareas/${task.id}`}>
                <Eye className="size-4" />
                Ver
              </Link>
            </DropdownMenuItem>
          ) : null}
          {showReschedule ? (
            <DropdownMenuItem onClick={() => openRescheduleDialog(task)}>
              <CalendarClock className="size-4" />
              Reprogramar OT
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
          <ForceDeleteAction
            entityType="task"
            entityId={task.id}
            entityLabel={task.code?.trim() || task.title?.trim() || task.id}
            presentation="menu-item"
            onSuccess={(message) => {
              removeTaskLocally(task.id)
              setFeedback({ type: "success", message })
            }}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Órdenes de trabajo</h3>
          <p className="text-xs text-muted-foreground">
            {projectTasks.length} OT
          </p>
        </div>
        <Button size="sm" className="gap-1.5 self-start" onClick={openCreateDialog}>
          <Plus className="size-4" />
          Nueva OT
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
        <div className="space-y-2">
          {projectTasks.map((task) => {
            const hasChecklist =
              readOperationalChecklistTemplate(task).length > 0

            return (
              <article
                key={task.id}
                className={`rounded-lg border bg-card p-3 shadow-sm ${getTaskStatusSurfaceClass(task.status, { accent: false, ring: true })}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-mono text-xs font-medium text-primary">
                        {task.code}
                      </p>
                      <TaskStatusBadge status={task.status} />
                      <TaskPriorityBadge priority={task.priority} />
                      {hasChecklist ? (
                        <Badge variant="outline" className="text-[10px]">
                          Checklist
                        </Badge>
                      ) : null}
                    </div>
                    <div>
                      <Link
                        href={`/tareas/${task.id}`}
                        className="text-sm font-medium text-foreground hover:text-primary"
                      >
                        {task.title}
                      </Link>
                      {task.description?.trim() ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {task.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <TaskCrewAssignmentCell
                        task={task}
                        getCrew={getCrew}
                        compact
                      />
                      <span>{formatTaskDate(task.dueDate)}</span>
                    </div>
                  </div>
                  {renderActions(task)}
                </div>
              </article>
            )
          })}
        </div>
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

      {rescheduleTarget ? (
        <ProjectTaskRescheduleDialog
          open
          onOpenChange={(open) => {
            if (!open) setRescheduleTarget(null)
          }}
          task={rescheduleTarget}
          rescheduledBy={actorName}
          isSubmitting={isRescheduling}
          onConfirm={handleRescheduleConfirm}
        />
      ) : null}

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
