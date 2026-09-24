"use client"

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react"
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
  Route,
} from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { TASK_DELETE_USER_MESSAGE } from "@/lib/operations/user-messages"
import { ForceDeleteAction } from "@/components/admin/force-delete-action"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { TaskCrewAssignmentCell } from "@/components/obras/task-crew-assignment-cell"
import { ProjectTaskDialog } from "@/components/obras/project-task-dialog"
import { ProjectDesignOtProposalDialog } from "@/components/obras/project-design-ot-proposal-dialog"
import { ProjectDesignOtProposalsSection } from "@/components/obras/project-design-ot-proposals-section"
import {
  ProjectDesignTendidoOtDialog,
  type TendidoOtCreatePayload,
} from "@/components/obras/project-design-tendido-ot-dialog"
import { ProjectDesignGenerateOtDialog } from "@/components/obras/design/project-design-generate-ot-dialog"
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
import { toLocalDateOnly } from "@/lib/dates/date-only"
import { hasCoordinates } from "@/lib/gps/coordinates"
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
import { formatDailyAllocationHistoryNote } from "@/lib/projects/task-daily-allocations"
import type { TaskDailyAllocationDraft } from "@/lib/projects/task-daily-allocations"
import { syncTaskDailyAllocations } from "@/lib/supabase/task-daily-allocations.browser"
import { resolveProjectTaskFieldDispatchBadge } from "@/lib/projects/project-task-field-release"
import { canRescheduleProjectTaskFromSession } from "@/lib/projects/project-task-reschedule"
import { resolveProjectTaskRowActions } from "@/lib/projects/project-task-row-actions"
import { ProjectTaskClosureReviewSheet } from "@/components/obras/project-task-closure-review-sheet"
import { generateTaskCode } from "@/lib/tasks/utils"
import { resolveCrewSnapshotsForAssignment, isTaskCrewArchived } from "@/lib/tasks/crew-relation"
import {
  mergeMaterialsNeededIntoMetadata,
} from "@/lib/tasks/work-order"
import {
  buildCreatedProposalPatch,
  buildObraTaskCreatePayloadFromProposal,
  buildProposalEditPatch,
  canCancelProjectDesignOtProposal,
  planProjectDesignOtProposals,
  validateProposalForObraTaskCreate,
} from "@/lib/projects/design/ot-proposals"
import { mergeTendidoPlanIntoMetadata } from "@/lib/projects/design/tendido"
import {
  createProjectDesignOtProposals,
  listProjectDesignOtProposals,
  updateProjectDesignOtProposal,
} from "@/lib/supabase/project-design-ot.browser"
import { listProjectDesign } from "@/lib/supabase/project-design.browser"
import type {
  CreateProjectDesignOtProposalInput,
  ProjectDesignOtProposal,
} from "@/lib/types/project-design-ot"
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
  projectTasks: Task[]
  setProjectTasks: Dispatch<SetStateAction<Task[]>>
  loadProjectTasks: (options?: { silent?: boolean }) => Promise<void>
}

type DialogMode = "create" | "edit"
type FieldDispatchConfirm = {
  task: Task
  mode: "release" | "return"
}

export function ProjectTasksTab({
  project,
  projectTasks,
  setProjectTasks,
  loadProjectTasks,
}: ProjectTasksTabProps) {
  const { sessionUser } = useAuth()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const {
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
  const [closureReviewTask, setClosureReviewTask] = useState<Task | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [feedback, setFeedback] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)
  const [proposals, setProposals] = useState<ProjectDesignOtProposal[]>([])
  const [selectedProposal, setSelectedProposal] =
    useState<ProjectDesignOtProposal | null>(null)
  const [proposalDialogOpen, setProposalDialogOpen] = useState(false)
  const [proposalBusy, setProposalBusy] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [generateBusy, setGenerateBusy] = useState(false)
  const [generateSummary, setGenerateSummary] = useState<{
    nodeNew: number
    napNew: number
    reused: number
    payloads: CreateProjectDesignOtProposalInput[]
  }>({ nodeNew: 0, napNew: 0, reused: 0, payloads: [] })
  const [tendidoOpen, setTendidoOpen] = useState(false)
  const [tendidoBusy, setTendidoBusy] = useState(false)

  const actorName =
    sessionUser?.displayName?.trim() ||
    sessionUser?.email?.trim() ||
    "Usuario"

  const archivedCrewTaskCount = useMemo(
    () => projectTasks.filter((task) => isTaskCrewArchived(task, getCrew)).length,
    [projectTasks, getCrew]
  )

  const loadProposals = useCallback(async () => {
    if (!isAuthReady || !companyId) return
    const result = await listProjectDesignOtProposals(companyId, project.id)
    if (result.error || !result.data) {
      setFeedback({
        type: "error",
        message:
          result.error?.message ?? "No se pudieron cargar las OTs preliminares.",
      })
      return
    }
    setProposals(result.data)
  }, [companyId, isAuthReady, project.id])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      if (!isAuthReady || !companyId) return
      const result = await listProjectDesignOtProposals(companyId, project.id)
      if (cancelled) return
      if (result.error || !result.data) {
        setFeedback({
          type: "error",
          message:
            result.error?.message ?? "No se pudieron cargar las OTs preliminares.",
        })
        return
      }
      setProposals(result.data)
    })()

    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady, project.id])

  async function openGenerateOtProposals() {
    if (!isAuthReady || !companyId) {
      setFeedback({
        type: "error",
        message: "No se pudo identificar la compañía para generar preliminares.",
      })
      return
    }

    setGenerateBusy(true)
    const [design, existing] = await Promise.all([
      listProjectDesign(companyId, project.id),
      listProjectDesignOtProposals(companyId, project.id),
    ])
    setGenerateBusy(false)

    if (design.error || !design.data) {
      setFeedback({
        type: "error",
        message: design.error?.message ?? "No se pudo cargar el diseño.",
      })
      return
    }
    if (existing.error || !existing.data) {
      setFeedback({
        type: "error",
        message:
          existing.error?.message ?? "No se pudieron cargar las preliminares.",
      })
      return
    }

    setProposals(existing.data)
    setGenerateSummary(
      planProjectDesignOtProposals({
        companyId,
        projectId: project.id,
        elements: design.data.elements,
        existing: existing.data,
      })
    )
    setGenerateOpen(true)
  }

  async function confirmGenerateOtProposals() {
    if (!isAuthReady || !companyId) return
    if (generateSummary.payloads.length === 0) {
      setGenerateOpen(false)
      return
    }

    setGenerateBusy(true)
    const result = await createProjectDesignOtProposals(
      companyId,
      project.id,
      generateSummary.payloads
    )
    setGenerateBusy(false)
    if (result.error || !result.data) {
      setFeedback({
        type: "error",
        message: result.error?.message ?? "No se pudieron generar las preliminares.",
      })
      return
    }

    await loadProposals()
    setGenerateOpen(false)
    const count = result.data.length
    setFeedback({
      type: "success",
      message:
        count === 1
          ? "Se generó 1 OT preliminar."
          : `Se generaron ${count} OTs preliminares.`,
    })
  }

  function openProposalDialog(proposal: ProjectDesignOtProposal) {
    setSelectedProposal(proposal)
    setProposalDialogOpen(true)
  }

  function upsertProposal(next: ProjectDesignOtProposal) {
    setProposals((current) => {
      const index = current.findIndex((item) => item.id === next.id)
      if (index < 0) return [...current, next]
      const copy = [...current]
      copy[index] = next
      return copy
    })
    setSelectedProposal(next)
  }

  async function handleSaveProposal(next: ProjectDesignOtProposal) {
    if (!isAuthReady || !companyId) {
      setFeedback({
        type: "error",
        message: "No se pudo identificar la compañía para guardar la preliminar.",
      })
      return false
    }

    setProposalBusy(true)
    const result = await updateProjectDesignOtProposal(
      companyId,
      project.id,
      next.id,
      buildProposalEditPatch(next, {
        title: next.title,
        workType: next.workType,
        priority: next.priority,
        crewId: next.crewId,
        startDate: next.startDate,
        dueDate: next.dueDate,
        latitude: next.latitude,
        longitude: next.longitude,
        observations: next.observations,
        operationalChecklistTemplate: next.operationalChecklistTemplate,
      })
    )
    setProposalBusy(false)

    if (result.error || !result.data) {
      setFeedback({
        type: "error",
        message: result.error?.message ?? "No se pudo guardar la preliminar.",
      })
      return false
    }

    upsertProposal(result.data)
    return true
  }

  async function handleCreateOtFromProposal(proposal: ProjectDesignOtProposal) {
    if (!isAuthReady || !companyId) {
      setFeedback({
        type: "error",
        message: "No se pudo identificar la compañía para crear la OT.",
      })
      return false
    }

    const validation = validateProposalForObraTaskCreate(proposal)
    if (!validation.ok) {
      setFeedback({ type: "error", message: validation.message })
      return false
    }

    const selectedCrew = proposal.crewId ? getCrew(proposal.crewId) : undefined
    const snapshots = resolveCrewSnapshotsForAssignment(selectedCrew)
    const built = buildObraTaskCreatePayloadFromProposal({
      project,
      proposal,
      crewName: snapshots.crew,
      supervisor: snapshots.supervisor,
    })
    if (!built.ok) {
      setFeedback({ type: "error", message: built.message })
      return false
    }

    setProposalBusy(true)
    try {
      const latestResult = await listProjectDesignOtProposals(companyId, project.id)
      const latest = latestResult.data?.find((item) => item.id === proposal.id)
      if (latest && (latest.status === "created" || latest.taskId)) {
        upsertProposal(latest)
        setFeedback({
          type: "error",
          message: "Esta preliminar ya tiene una OT creada.",
        })
        return false
      }

      const created = await addTask({
        code: generateTaskCode(project.code, projectTasks),
        title: built.payload.title,
        description: built.payload.description,
        observationsForCrew: built.payload.observationsForCrew,
        projectId: built.payload.projectId,
        projectCode: built.payload.projectCode,
        projectName: built.payload.projectName,
        type: built.payload.type,
        priority: built.payload.priority,
        supervisor: built.payload.supervisor || snapshots.supervisor,
        crewId: snapshots.crewId ?? undefined,
        crew: snapshots.crew || built.payload.crew,
        startDate: built.payload.startDate,
        dueDate: built.payload.dueDate,
        estimatedDuration: built.payload.estimatedDuration,
        latitude: built.payload.latitude,
        longitude: built.payload.longitude,
        checklist: [],
        taskMetadata: mergeMaterialsNeededIntoMetadata(
          built.payload.taskMetadata,
          ""
        ),
        status: built.status,
      })

      let linked = await updateProjectDesignOtProposal(
        companyId,
        project.id,
        proposal.id,
        buildCreatedProposalPatch(created.id)
      )
      if (linked.error || !linked.data) {
        linked = await updateProjectDesignOtProposal(
          companyId,
          project.id,
          proposal.id,
          buildCreatedProposalPatch(created.id)
        )
      }
      if (linked.error || !linked.data) {
        setFeedback({
          type: "error",
          message:
            "La OT se creó, pero no se pudo vincular la preliminar. Recargá la pestaña e intentá de nuevo.",
        })
        await loadProposals()
        void loadProjectTasks({ silent: true })
        return false
      }

      await syncTaskDailyAllocations({
        companyId,
        taskId: created.id,
        allocations: [],
      })
      void loadProjectTasks({ silent: true })
      upsertProposal(linked.data)
      setFeedback({
        type: "success",
        message: `OT creada: ${created.code}. Ya podés enviarla a cuadrilla desde la OT real.`,
      })
      return true
    } catch (caught) {
      setFeedback({
        type: "error",
        message:
          caught instanceof Error
            ? caught.message
            : "No se pudo crear la orden de trabajo.",
      })
      return false
    } finally {
      setProposalBusy(false)
    }
  }

  async function handleCancelProposal(proposal: ProjectDesignOtProposal) {
    if (!isAuthReady || !companyId) {
      setFeedback({
        type: "error",
        message: "No se pudo identificar la compañía para cancelar la preliminar.",
      })
      return false
    }
    if (!canCancelProjectDesignOtProposal(proposal)) {
      setFeedback({
        type: "error",
        message: "Esta preliminar ya no se puede cancelar.",
      })
      return false
    }

    setProposalBusy(true)
    const result = await updateProjectDesignOtProposal(
      companyId,
      project.id,
      proposal.id,
      { status: "cancelled" }
    )
    setProposalBusy(false)
    if (result.error || !result.data) {
      setFeedback({
        type: "error",
        message: result.error?.message ?? "No se pudo cancelar la preliminar.",
      })
      return false
    }

    setProposals((current) =>
      current.map((item) => (item.id === result.data!.id ? result.data! : item))
    )
    setSelectedProposal(result.data)
    setFeedback({
      type: "success",
      message: "Preliminar cancelada. Podés volver a generarla desde Diseño.",
    })
    return true
  }

  async function handleCreateTendidoOt(payload: TendidoOtCreatePayload) {
    if (!isAuthReady || !companyId) {
      setFeedback({
        type: "error",
        message: "No se pudo identificar la compañía para crear la OT.",
      })
      return false
    }

    const selectedCrew = getCrew(payload.crewId)
    const snapshots = resolveCrewSnapshotsForAssignment(selectedCrew)
    const hasGps = hasCoordinates(payload.latitude, payload.longitude)

    setTendidoBusy(true)
    try {
      const created = await addTask({
        code: generateTaskCode(project.code, projectTasks),
        title: payload.title,
        description: "",
        observationsForCrew: payload.observations,
        projectId: project.id,
        projectCode: project.code,
        projectName: project.name,
        type: project.type,
        priority: payload.priority,
        supervisor: snapshots.supervisor,
        crewId: snapshots.crewId ?? undefined,
        crew: snapshots.crew,
        startDate: payload.startDate,
        dueDate: payload.dueDate,
        estimatedDuration: "",
        latitude: hasGps ? (payload.latitude as number) : undefined,
        longitude: hasGps ? (payload.longitude as number) : undefined,
        checklist: [],
        taskMetadata: mergeMaterialsNeededIntoMetadata(
          mergeTaskMetadataWithTemplate(
            {
              taskMetadata: mergeTendidoPlanIntoMetadata({}, payload.plan),
            },
            payload.operationalChecklistTemplate
          ),
          ""
        ),
        status: resolveProjectTaskCreateStatus(project.status),
      })

      await syncTaskDailyAllocations({
        companyId,
        taskId: created.id,
        allocations: [],
      })
      void loadProjectTasks({ silent: true })
      setFeedback({
        type: "success",
        message: `OT de Tendido creada: ${created.code}.`,
      })
      return true
    } catch (caught) {
      setFeedback({
        type: "error",
        message:
          caught instanceof Error
            ? caught.message
            : "No se pudo crear la orden de trabajo de Tendido.",
      })
      return false
    } finally {
      setTendidoBusy(false)
    }
  }

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
    dailyAllocations: TaskDailyAllocationDraft[]
    syncMaterialLines?: (taskId: string) => Promise<void>
  }) {
    if (!isAuthReady || !companyId) {
      throw new Error("No se pudo identificar la compañía para guardar la OT.")
    }

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
      const fieldHistory = formatProjectTaskSupervisedEditHistoryNote(
        fieldChanges,
        { actor: actorName }
      )
      const allocationHistory = formatDailyAllocationHistoryNote(
        selectedTask.dailyAllocations,
        payload.dailyAllocations,
        { actor: actorName }
      )
      const historyNote = [fieldHistory, allocationHistory]
        .filter(Boolean)
        .join(" ")

      const result = await editTask(selectedTask.id, updatePayload, {
        historyNote: historyNote || undefined,
        historyActor: actorName,
      })

      if (!result.success) {
        throw new Error(result.message ?? "No se pudo actualizar la orden de trabajo.")
      }

      if (payload.syncMaterialLines) {
        await payload.syncMaterialLines(selectedTask.id)
      }

      await syncTaskDailyAllocations({
        companyId,
        taskId: selectedTask.id,
        allocations: payload.dailyAllocations,
      })
      void loadProjectTasks({ silent: true })

      setFeedback({
        type: "success",
        message: "Orden de trabajo actualizada correctamente.",
      })
      return
    }

    const selectedCrew = getCrew(payload.crewId)
    const snapshots = resolveCrewSnapshotsForAssignment(selectedCrew)

    const created = await addTask({
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

    if (payload.syncMaterialLines) {
      await payload.syncMaterialLines(created.id)
    }

    await syncTaskDailyAllocations({
      companyId,
      taskId: created.id,
      allocations: payload.dailyAllocations,
    })
    void loadProjectTasks({ silent: true })

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
    setProjectTasks((current) =>
      current.filter((task) => task.id !== deleteTarget.id)
    )
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
    void loadProjectTasks({ silent: true })
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
        ? await releaseProjectTaskToField(task.id, { actor: actorName, task })
        : await returnProjectTaskFromField(task.id, { actor: actorName, task })
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
    void loadProjectTasks({ silent: true })
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
            onClick={() => {
              setClosureReviewTask(task)
              setClosureReviewTaskId(task.id)
            }}
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
              setProjectTasks((current) =>
                current.filter((item) => item.id !== task.id)
              )
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
        <div className="flex flex-wrap gap-2 self-start">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => void openGenerateOtProposals()}
            disabled={generateBusy}
          >
            Generar OTs preliminares
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setTendidoOpen(true)}
            disabled={tendidoBusy || !isAuthReady || !companyId}
          >
            <Route className="size-4" />
            OT de Tendido
          </Button>
          <Button size="sm" className="gap-1.5" onClick={openCreateDialog}>
            <Plus className="size-4" />
            Nueva OT
          </Button>
        </div>
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

      <ProjectDesignOtProposalsSection
        proposals={proposals}
        tasks={projectTasks}
        designHref={`/obras/${project.id}/diseno`}
        getCrew={getCrew}
        onSelect={openProposalDialog}
      />

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

      <ProjectDesignGenerateOtDialog
        open={generateOpen}
        nodeNew={generateSummary.nodeNew}
        napNew={generateSummary.napNew}
        reused={generateSummary.reused}
        busy={generateBusy}
        onOpenChange={setGenerateOpen}
        onConfirm={() => void confirmGenerateOtProposals()}
      />

      <ProjectDesignOtProposalDialog
        key={selectedProposal?.id ?? "proposal-closed"}
        open={proposalDialogOpen}
        proposal={selectedProposal}
        taskCode={
          selectedProposal?.taskId
            ? projectTasks.find((task) => task.id === selectedProposal.taskId)
                ?.code ?? null
            : null
        }
        busy={proposalBusy}
        onOpenChange={(open) => {
          setProposalDialogOpen(open)
          if (!open) setSelectedProposal(null)
        }}
        onSave={handleSaveProposal}
        onCreateOt={handleCreateOtFromProposal}
        onCancelProposal={handleCancelProposal}
      />

      {companyId && tendidoOpen ? (
        <ProjectDesignTendidoOtDialog
          open={tendidoOpen}
          project={project}
          companyId={companyId}
          busy={tendidoBusy}
          onOpenChange={setTendidoOpen}
          onCreate={handleCreateTendidoOt}
        />
      ) : null}

      <ProjectTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        project={project}
        task={selectedTask}
        existingTasks={projectTasks}
        onSubmit={handleCreateOrEdit}
      />

      <ProjectTaskClosureReviewSheet
        open={closureReviewTaskId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setClosureReviewTaskId(null)
            setClosureReviewTask(null)
          }
        }}
        taskId={closureReviewTaskId}
        task={closureReviewTask}
        onReviewCompleted={() => {
          void loadProjectTasks({ silent: true })
        }}
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
