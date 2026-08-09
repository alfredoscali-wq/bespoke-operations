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
  Send,
  Trash2,
  Undo2,
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
import { getTaskStatusSurfaceClass } from "@/lib/tasks/status-visual"
import { compareDateOnly, toLocalDateOnly } from "@/lib/dates/date-only"
import {
  formatPlanningMultiDayBadge,
  formatPlanningTaskDateRangeLabel,
} from "@/lib/planificacion/planning-date-range"
import {
  canEditProjectTaskFromObras,
  resolveProjectTaskCreateStatus,
} from "@/lib/projects/project-start-dispatch"
import {
  assertProjectTaskSupervisedEditPayloadSafe,
  buildProjectTaskSupervisedEditFieldChanges,
  formatProjectTaskSupervisedEditHistoryNote,
} from "@/lib/projects/project-task-supervised-edit"
import { resolveProjectTaskFieldDispatchBadge } from "@/lib/projects/project-task-field-release"
import { canRescheduleProjectTaskFromSession } from "@/lib/projects/project-task-reschedule"
import { resolveProjectTaskRowActions } from "@/lib/projects/project-task-row-actions"
import { ProjectTaskClosureReviewSheet } from "@/components/obras/project-task-closure-review-sheet"
import { getTasksForProject } from "@/lib/tasks/utils"
import { resolveCrewSnapshotsForAssignment, isTaskCrewArchived } from "@/lib/tasks/crew-relation"
import {
  mergeMaterialsNeededIntoMetadata,
} from "@/lib/tasks/work-order"
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
type FieldDispatchConfirm = {
  task: Task
  mode: "release" | "return"
}

export function ProjectTasksTab({ project }: ProjectTasksTabProps) {
  const { sessionUser } = useAuth()
  const {
    tasks,
    addTask,
    editTask,
    deleteTask,
    removeTaskLocally,
    rescheduleProjectTask,
    releaseProjectTaskToField,
    returnProjectTaskFromField,
  } = useTasks()
  const { getCrew } = useCrews()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode>("create")
  const [selectedTask, setSelectedTask] = useState<Task | undefined>()
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)
  const [rescheduleTarget, setRescheduleTarget] = useState<Task | null>(null)
  const [isRescheduling, setIsRescheduling] = useState(false)
  const [fieldDispatchConfirm, setFieldDispatchConfirm] =
    useState<FieldDispatchConfirm | null>(null)
  const [isFieldDispatching, setIsFieldDispatching] = useState(false)
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
          "Esta OT de Obra no puede editarse en su estado actual desde Obras.",
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
    materialsNeeded: string
    operationalChecklistTemplate: OperationalChecklistTemplateItem[]
    latitude?: number | null
    longitude?: number | null
    sharedLocation?: string | null
  }) {
    if (dialogMode === "edit" && selectedTask) {
      if (!canEditProjectTaskFromObras(selectedTask)) {
        throw new Error(
          "Esta OT de Obra no puede editarse en su estado actual desde Obras."
        )
      }

      const selectedCrew = getCrew(payload.crewId)
      const snapshots = resolveCrewSnapshotsForAssignment(selectedCrew)

      const updatePayload = {
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
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        sharedLocation: payload.sharedLocation ?? null,
        taskMetadata: mergeMaterialsNeededIntoMetadata(
          mergeTaskMetadataWithTemplate(
            selectedTask,
            payload.operationalChecklistTemplate
          ),
          payload.materialsNeeded
        ),
      }

      if (!assertProjectTaskSupervisedEditPayloadSafe(updatePayload)) {
        throw new Error(
          "La edición supervisada no puede modificar estado, obra ni orden de ruta."
        )
      }

      const fieldChanges = buildProjectTaskSupervisedEditFieldChanges(
        selectedTask,
        updatePayload,
        payload.materialsNeeded
      )
      const historyNote = formatProjectTaskSupervisedEditHistoryNote(
        fieldChanges,
        { actor: actorName }
      )

      const result = await editTask(selectedTask.id, updatePayload, {
        historyNote: historyNote ?? undefined,
        historyActor: actorName,
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
      latitude: payload.latitude ?? undefined,
      longitude: payload.longitude ?? undefined,
      sharedLocation: payload.sharedLocation ?? undefined,
      checklist: [],
      taskMetadata: mergeMaterialsNeededIntoMetadata(
        mergeTaskMetadataWithTemplate(
          {},
          payload.operationalChecklistTemplate
        ),
        payload.materialsNeeded
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

  async function handleFieldDispatchConfirm() {
    if (!fieldDispatchConfirm) return

    setIsFieldDispatching(true)
    const { task, mode } = fieldDispatchConfirm
    const result =
      mode === "release"
        ? await releaseProjectTaskToField(task.id, { actor: actorName })
        : await returnProjectTaskFromField(task.id, { actor: actorName })
    setIsFieldDispatching(false)

    if (!result.success) {
      setFeedback({
        type: "error",
        message:
          result.message ??
          (mode === "release"
            ? "No se pudo enviar la OT a la cuadrilla."
            : "No se pudo devolver la OT a Obras."),
      })
      return
    }

    setFieldDispatchConfirm(null)
    setFeedback({
      type: "success",
      message:
        mode === "release"
          ? "OT enviada a la cuadrilla."
          : "OT retirada del campo.",
    })
  }

  function renderActions(task: Task) {
    const actions = resolveProjectTaskRowActions(task)
    const showReschedule = canRescheduleProjectTaskFromSession(
      sessionUser,
      task
    )

    return (
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
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
            Reprogramar
          </Button>
        ) : null}
        {actions.showReleaseToField ? (
          <Button
            size="sm"
            className="h-8 gap-1 px-2.5 text-xs"
            onClick={() =>
              setFieldDispatchConfirm({ task, mode: "release" })
            }
          >
            <Send className="size-3.5" />
            Enviar a Cuadrilla
          </Button>
        ) : null}
        {actions.showReturnFromField ? (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 px-2.5 text-xs"
            onClick={() =>
              setFieldDispatchConfirm({ task, mode: "return" })
            }
          >
            <Undo2 className="size-3.5" />
            Devolver a Obras
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
          {actions.showReleaseToField ? (
            <DropdownMenuItem
              onClick={() =>
                setFieldDispatchConfirm({ task, mode: "release" })
              }
            >
              <Send className="size-4" />
              Enviar a Cuadrilla
            </DropdownMenuItem>
          ) : null}
          {actions.showReturnFromField ? (
            <DropdownMenuItem
              onClick={() =>
                setFieldDispatchConfirm({ task, mode: "return" })
              }
            >
              <Undo2 className="size-4" />
              Devolver a Obras
            </DropdownMenuItem>
          ) : null}
          {actions.showEdit ? (
            <DropdownMenuItem onClick={() => openEditDialog(task)}>
              <Pencil className="size-4" />
              Editar OT
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled>
              <Pencil className="size-4" />
              Editar OT
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
            const dateRangeLabel = formatPlanningTaskDateRangeLabel(task)
            const multiDayBadge = formatPlanningMultiDayBadge(
              task,
              toLocalDateOnly()
            )
            const fieldDispatchBadge =
              resolveProjectTaskFieldDispatchBadge(task)

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
                      {fieldDispatchBadge ? (
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-medium"
                        >
                          {fieldDispatchBadge}
                        </Badge>
                      ) : null}
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
                      <span className="tabular-nums">{dateRangeLabel}</span>
                      {multiDayBadge ? (
                        <span className="rounded border border-sky-200 bg-sky-50 px-1.5 py-px text-[10px] font-medium text-sky-800">
                          {multiDayBadge}
                        </span>
                      ) : null}
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
        open={fieldDispatchConfirm !== null}
        onOpenChange={(open) => {
          if (!open && !isFieldDispatching) {
            setFieldDispatchConfirm(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {fieldDispatchConfirm?.mode === "return"
                ? "Devolver OT a Obras"
                : "Enviar OT a Campo"}
            </DialogTitle>
            <DialogDescription>
              {fieldDispatchConfirm?.mode === "return" ? (
                <>
                  ¿Desea retirar esta OT del campo?
                  <span className="mt-2 block text-muted-foreground">
                    La cuadrilla dejará de visualizar esta OT hasta que vuelva a
                    ser enviada.
                  </span>
                </>
              ) : (
                <>
                  ¿Desea enviar esta OT a la cuadrilla asignada?
                  <span className="mt-2 block text-muted-foreground">
                    La OT quedará disponible para Field Agent según su fecha
                    programada.
                  </span>
                </>
              )}
              {fieldDispatchConfirm?.task ? (
                <span className="mt-2 block font-medium text-foreground">
                  {fieldDispatchConfirm.task.code} —{" "}
                  {fieldDispatchConfirm.task.title}
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFieldDispatchConfirm(null)}
              disabled={isFieldDispatching}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleFieldDispatchConfirm()}
              disabled={isFieldDispatching}
            >
              {isFieldDispatching
                ? "Guardando…"
                : fieldDispatchConfirm?.mode === "return"
                  ? "Devolver a Obras"
                  : "Enviar a Cuadrilla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
