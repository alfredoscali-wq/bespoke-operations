"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { useDemoMode } from "@/components/demo/demo-mode-provider"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  blockDemoWrite,
  DemoWriteBlockedError,
  DEMO_WRITE_BLOCKED_TASK_RESULT,
} from "@/lib/demo/demo-write-block"
import {
  enrichCreateTaskPayloadWithResolvedLocation,
  enrichUpdateTaskPayloadWithResolvedLocation,
} from "@/lib/location/client/enrich-task-payload"

import {
  getTaskDetail,
} from "@/lib/data/tasks"
import {
  createBrowserTasksClient,
  createTask,
  deleteTask as deleteTaskInSupabase,
  listOccupiedTaskCodesByPrefix,
  listTasks,
  updateTask as updateTaskInSupabase,
} from "@/lib/supabase/tasks.browser"
import {
  deleteWorkOrderThroughAdminApi,
  updateWorkOrderThroughAdminApi,
} from "@/lib/supabase/tasks-admin-api.client"
import { canArchiveTaskByStatus } from "@/lib/tasks/status-groups"
import { resolveIncidentReasonLabel } from "@/lib/tasks/incidents"
import { TASK_DELETE_USER_MESSAGE, TASK_ARCHIVE_BLOCKED_ACTIVE_MESSAGE, logOperationError } from "@/lib/operations/user-messages"
import { logDeleteTrace } from "@/lib/supabase/delete-trace"
import { mapTaskToUpdatePayload } from "@/lib/supabase/tasks.mapper"
import {
  canPerformTaskAction,
  getInitialTaskStatus,
  getTransitionForAction,
  getWorkflowActionForTargetStatus,
  getWorkflowHistoryEntry,
  resolveStatusAfterCrewAssignment,
  type TaskWorkflowAction,
} from "@/lib/tasks/task-status-workflow"
import {
  syncTaskProgress,
} from "@/lib/tasks/utils"
import { generateWorkOrderTaskCodeFromCodes } from "@/lib/tasks/work-order"
import { applyWorkOrderApprovalEffects } from "@/lib/tasks/work-order-approval-effects"
import { buildDispatchOrderConfirmUpdates } from "@/lib/tasks/dispatch-order"
import {
  buildDispatchOrderPersistPlan,
  buildExecutionOrderPersistPlan,
  buildOperationalOrderRemovalUpdates,
  isOperationalOrderReorderable,
  resolveOperationalOrderOnDateChange,
  type ExecutionOrderUpdate,
} from "@/lib/planificacion/planning-execution-order"
import { resolveTaskCrewId } from "@/lib/tasks/crew-relation"
import { getTaskEvidencePhotoCount, getOperationalStepPhotoCounts } from "@/lib/supabase/task-photos.browser"
import {
  getOperationalStepsProgress,
  hasOperationalSteps,
  syncOperationalStepsWithPhotoCounts,
} from "@/lib/operational-steps/utils"
import type { CreateTaskPayload, UpdateTaskPayload } from "@/lib/types/supabase/tasks"
import type { Task, TaskDetail, TaskStatus } from "@/lib/types/tasks"
import {
  buildTaskRescheduleHistoryNote,
  buildTaskRescheduleUpdatePayload,
  validateTaskRescheduleInput,
  type TaskRescheduleInput,
} from "@/lib/tasks/reschedule"
import {
  applyVencidaSyncFromApi,
  mergeVencidaStatusIntoTasks,
} from "@/lib/tasks/vencida-sync.client"
import {
  recordTaskCreateAudit,
  recordTaskDeleteAudit,
  recordTaskMutationAudit,
} from "@/lib/audit/tasks-audit"

type TaskMutationResult = {
  success: boolean
  message?: string
  task?: Task
}

type TaskMutationOptions = {
  administration?: boolean
}

type TasksContextValue = {
  tasks: Task[]
  isTasksReady: boolean
  usesSupabase: boolean
  detailVersion: number
  getTask: (id: string) => Task | undefined
  getDetail: (id: string) => TaskDetail | undefined
  addTask: (input: CreateTaskPayload) => Promise<Task>
  editTask: (
    id: string,
    payload: UpdateTaskPayload,
    options?: TaskMutationOptions
  ) => Promise<TaskMutationResult>
  changeTaskStatus: (id: string, targetStatus: TaskStatus) => Promise<TaskMutationResult>
  assignCrew: (
    id: string,
    crewId: string | null,
    crewName?: string,
    supervisor?: string,
    options?: { promoteToAssigned?: boolean }
  ) => Promise<TaskMutationResult>
  deleteTask: (id: string, options?: TaskMutationOptions) => Promise<TaskMutationResult>
  removeTaskLocally: (id: string) => void
  removeTasksByCustomerId: (customerId: string) => void
  startTask: (id: string) => Promise<TaskMutationResult>
  submitTaskForApproval: (id: string) => Promise<TaskMutationResult>
  approveTask: (id: string) => Promise<TaskMutationResult>
  rejectTask: (id: string, reason: string) => Promise<TaskMutationResult>
  closeTask: (id: string) => Promise<TaskMutationResult>
  cancelTask: (
    id: string,
    options?: {
      reason: string
      observation: string
      actor?: string
    }
  ) => Promise<TaskMutationResult>
  confirmPlanningTasks: (ids: string[]) => Promise<TaskMutationResult>
  reopenPlanningTasks: (ids: string[]) => Promise<TaskMutationResult>
  reportTaskIncident: (
    id: string,
    input: {
      reason: string
      observation: string
      reportedBy: string
    }
  ) => Promise<TaskMutationResult>
  resumeTaskFromIncident: (
    id: string,
    actor?: string
  ) => Promise<TaskMutationResult>
  rescheduleTaskFromIncident: (
    id: string,
    input: TaskRescheduleInput & { actor?: string }
  ) => Promise<TaskMutationResult>
  rescheduleTaskFromOverdue: (
    id: string,
    input: TaskRescheduleInput & { actor?: string }
  ) => Promise<TaskMutationResult>
  toggleChecklistItem: (taskId: string, itemId: string) => void
  syncOperationalStepsProgress: (
    taskId: string,
    stepPhotoCounts: Record<string, number>
  ) => Promise<TaskMutationResult>
  updateOperationalStepObservation: (
    taskId: string,
    stepId: string,
    observation: string
  ) => Promise<TaskMutationResult>
  addComment: (
    taskId: string,
    content: string,
    author?: string,
    role?: TaskDetail["comments"][number]["role"]
  ) => void
  addEvidence: (
    taskId: string,
    title: string,
    uploadedBy?: string
  ) => void
  refreshTasksFromServer: () => Promise<TaskMutationResult>
}

const TasksContext = createContext<TasksContextValue | null>(null)

const detailCache = new Map<string, TaskDetail>()

function cacheDetail(id: string, detail: TaskDetail) {
  detailCache.set(id, detail)
}

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const { isReadOnly, openRestrictedDialog } = useDemoMode()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [tasks, setTasks] = useState<Task[]>([])
  const [isTasksReady, setIsTasksReady] = useState(false)
  const [usesSupabase, setUsesSupabase] = useState(false)
  const [detailVersion, setDetailVersion] = useState(0)
  const usesSupabaseRef = useRef(false)
  const tasksRef = useRef<Task[]>([])

  useEffect(() => {
    usesSupabaseRef.current = usesSupabase
  }, [usesSupabase])

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  const runVencidaSync = useCallback(
    async (sourceTasks?: Task[]) => {
      const syncedTasks = await applyVencidaSyncFromApi(
        sourceTasks ?? tasksRef.current
      )
      setTasks((current) => mergeVencidaStatusIntoTasks(current, syncedTasks))
      return syncedTasks
    },
    []
  )

  useEffect(() => {
    if (!isAuthReady) {
      return
    }

    let cancelled = false

    async function loadTasksFromSupabase() {
      try {
        const client = createBrowserTasksClient()
        const result = await listTasks(companyId, client)

        if (cancelled) return

        if (result.error || result.data === null) {
          console.error("[TASKS LOAD]", result.error)
          setTasks([])
          setUsesSupabase(false)
          return
        }

        setTasks(result.data)
        setUsesSupabase(true)
      } catch (error) {
        if (!cancelled) {
          console.error("[TASKS LOAD]", error)
          setTasks([])
          setUsesSupabase(false)
        }
      } finally {
        if (!cancelled) {
          setIsTasksReady(true)
        }
      }
    }

    void loadTasksFromSupabase()

    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady])

  const refreshTasksFromServer = useCallback(async (): Promise<TaskMutationResult> => {
    if (!companyId) {
      return {
        success: false,
        message: "No se pudieron actualizar las órdenes de trabajo.",
      }
    }

    try {
      const client = createBrowserTasksClient()
      const result = await listTasks(companyId, client)

      if (result.error || result.data === null) {
        return {
          success: false,
          message:
            result.error?.message ??
            "No se pudieron actualizar las órdenes de trabajo.",
        }
      }

      setTasks(result.data)
      detailCache.clear()
      setDetailVersion((version) => version + 1)

      return { success: true }
    } catch (error) {
      console.error("[TASKS REFRESH]", error)
      return {
        success: false,
        message: "No se pudieron actualizar las órdenes de trabajo.",
      }
    }
  }, [companyId])

  useEffect(() => {
    if (!usesSupabase) {
      return
    }

    void runVencidaSync()

    const interval = window.setInterval(() => {
      void runVencidaSync()
    }, 60_000)

    return () => {
      window.clearInterval(interval)
    }
  }, [usesSupabase, runVencidaSync])

  const persistTaskUpdate = useCallback(async (task: Task) => {
    if (!usesSupabaseRef.current) return

    try {
      const client = createBrowserTasksClient()
      await updateTaskInSupabase(task.id, mapTaskToUpdatePayload(task), client)
    } catch {
      // Keep optimistic local state if persistence fails.
    }
  }, [])

  const mergeTaskUpdate = useCallback((task: Task, payload: UpdateTaskPayload): Task => {
    return syncTaskProgress({
      ...task,
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.description !== undefined
        ? { description: payload.description }
        : {}),
      ...(payload.priority !== undefined ? { priority: payload.priority } : {}),
      ...(payload.status !== undefined ? { status: payload.status } : {}),
      ...(payload.dueDate !== undefined ? { dueDate: payload.dueDate } : {}),
      ...(payload.supervisor !== undefined
        ? { supervisor: payload.supervisor }
        : {}),
      ...(payload.crew !== undefined ? { crew: payload.crew } : {}),
      ...(payload.crewId !== undefined ? { crewId: payload.crewId ?? undefined } : {}),
      ...(payload.startDate !== undefined ? { startDate: payload.startDate } : {}),
      ...(payload.scheduledTime !== undefined
        ? { scheduledTime: payload.scheduledTime }
        : {}),
      ...(payload.type !== undefined ? { type: payload.type } : {}),
      ...(payload.projectId !== undefined
        ? { projectId: payload.projectId ?? undefined }
        : {}),
      ...(payload.projectCode !== undefined
        ? { projectCode: payload.projectCode }
        : {}),
      ...(payload.projectName !== undefined
        ? { projectName: payload.projectName }
        : {}),
      ...(payload.customerCompany !== undefined
        ? { customerCompany: payload.customerCompany ?? undefined }
        : {}),
      ...(payload.customerName !== undefined
        ? { customerName: payload.customerName ?? undefined }
        : {}),
      ...(payload.customerPhone !== undefined
        ? { customerPhone: payload.customerPhone ?? undefined }
        : {}),
      ...(payload.serviceAddress !== undefined
        ? { serviceAddress: payload.serviceAddress ?? undefined }
        : {}),
      ...(payload.latitude !== undefined
        ? { latitude: payload.latitude ?? undefined }
        : {}),
      ...(payload.longitude !== undefined
        ? { longitude: payload.longitude ?? undefined }
        : {}),
      ...(payload.sharedLocation !== undefined
        ? { sharedLocation: payload.sharedLocation ?? undefined }
        : {}),
      ...(payload.observationsForCrew !== undefined
        ? { observationsForCrew: payload.observationsForCrew ?? undefined }
        : {}),
      ...(payload.rejectionReason !== undefined
        ? { rejectionReason: payload.rejectionReason ?? undefined }
        : {}),
      ...(payload.workOrderNumber !== undefined
        ? { workOrderNumber: payload.workOrderNumber ?? undefined }
        : {}),
      ...(payload.estimatedDuration !== undefined
        ? { estimatedDuration: payload.estimatedDuration }
        : {}),
      ...(payload.checklist !== undefined ? { checklist: payload.checklist } : {}),
      ...(payload.operationalSteps !== undefined
        ? { operationalSteps: payload.operationalSteps }
        : {}),
      ...(payload.progress !== undefined ? { progress: payload.progress } : {}),
      ...(payload.contractedPlan !== undefined
        ? { contractedPlan: payload.contractedPlan ?? undefined }
        : {}),
      ...(payload.amountToCollect !== undefined
        ? { amountToCollect: payload.amountToCollect ?? undefined }
        : {}),
      ...(payload.originalScheduledDate !== undefined
        ? { originalScheduledDate: payload.originalScheduledDate ?? undefined }
        : {}),
      ...(payload.originalScheduledTime !== undefined
        ? { originalScheduledTime: payload.originalScheduledTime ?? undefined }
        : {}),
      ...(payload.rescheduledBy !== undefined
        ? { rescheduledBy: payload.rescheduledBy ?? undefined }
        : {}),
      ...(payload.rescheduledAt !== undefined
        ? { rescheduledAt: payload.rescheduledAt ?? undefined }
        : {}),
      ...(payload.rescheduleReason !== undefined
        ? { rescheduleReason: payload.rescheduleReason ?? undefined }
        : {}),
      ...(payload.rescheduleNotes !== undefined
        ? { rescheduleNotes: payload.rescheduleNotes ?? undefined }
        : {}),
    })
  }, [])

  const addTask = useCallback(
    async (input: CreateTaskPayload): Promise<Task> => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        throw new DemoWriteBlockedError()
      }

      const status =
        input.status ??
        getInitialTaskStatus({ crewId: input.crewId, crew: input.crew })
      let payload: CreateTaskPayload = {
        ...input,
        companyId,
        status,
      }

      if (!usesSupabase) {
        throw new Error("No fue posible crear la orden de trabajo. Intente nuevamente.")
      }

      const client = createBrowserTasksClient()

      if (payload.projectCode === "OT") {
        const occupiedCodesResult = await listOccupiedTaskCodesByPrefix(
          companyId,
          "TSK-OT-",
          client
        )
        const mergedCodes = new Set<string>([
          ...tasks.map((task) => task.code),
          ...(occupiedCodesResult.data ?? []),
        ])

        payload = {
          ...payload,
          code: generateWorkOrderTaskCodeFromCodes(mergedCodes),
        }
      }

      payload = await enrichCreateTaskPayloadWithResolvedLocation(payload)

      console.log("BEFORE INSERT", payload)

      const result = await createTask(payload, client)

      if (!result.data) {
        logOperationError("TASK CREATE", result.error)
        throw new Error("No fue posible crear la orden de trabajo. Intente nuevamente.")
      }

      cacheDetail(result.data.id, getTaskDetail(result.data))
      setTasks((current) => [result.data!, ...current])
      recordTaskCreateAudit(result.data)
      return result.data
    },
    [tasks, usesSupabase, isReadOnly, openRestrictedDialog]
  )

  const updateTaskFields = useCallback(
    async (
      id: string,
      payload: UpdateTaskPayload,
      workflowAction?: TaskWorkflowAction,
      historyNote?: string,
      historyActor?: string,
      auditOptions?: {
        rescheduleInput?: TaskRescheduleInput
        suppressAudit?: boolean
      }
    ): Promise<TaskMutationResult> => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return DEMO_WRITE_BLOCKED_TASK_RESULT
      }

      const existing = tasks.find((item) => item.id === id)
      if (!existing) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      if (!usesSupabase) {
        return {
          success: false,
          message: "No fue posible actualizar la orden de trabajo. Intente nuevamente.",
        }
      }

      try {
        const client = createBrowserTasksClient()
        const enrichedPayload =
          await enrichUpdateTaskPayloadWithResolvedLocation(payload)
        const result = await updateTaskInSupabase(id, enrichedPayload, client)

        if (result.data) {
          if (!auditOptions?.suppressAudit) {
            recordTaskMutationAudit({
              before: existing,
              after: result.data,
              payload: enrichedPayload,
              workflowAction,
              rescheduleInput: auditOptions?.rescheduleInput,
            })
          }

          if (workflowAction) {
            const detail = detailCache.get(id) ?? getTaskDetail(result.data)
            const historyEntry = getWorkflowHistoryEntry(
              workflowAction,
              historyNote
            )

            cacheDetail(id, {
              ...detail,
              history: [
                {
                  id: `h-${Date.now()}`,
                  action: historyEntry.action,
                  description: historyEntry.description,
                  user: historyActor?.trim() || "Usuario",
                  timestamp: new Date().toISOString(),
                },
                ...detail.history,
              ],
            })
          }

          setTasks((current) => {
            const next = current.map((item) =>
              item.id === id ? result.data! : item
            )
            if (payload.dueDate !== undefined) {
              void applyVencidaSyncFromApi(next).then((syncedTasks) => {
                setTasks((latest) =>
                  mergeVencidaStatusIntoTasks(latest, syncedTasks)
                )
              })
            }
            return next
          })
          setDetailVersion((version) => version + 1)
          return { success: true, task: result.data }
        }

        if (result.error) {
          logOperationError("TASK UPDATE", result.error)
        }
      } catch (error) {
        logOperationError("TASK UPDATE", error)
      }

      return {
        success: false,
        message: "No fue posible actualizar la orden de trabajo. Intente nuevamente.",
      }
    },
    [tasks, usesSupabase, isReadOnly, openRestrictedDialog]
  )

  const editTask = useCallback(
    async (
      id: string,
      payload: UpdateTaskPayload,
      options?: TaskMutationOptions
    ): Promise<TaskMutationResult> => {
      const { status: _status, ...fieldsOnly } = payload

      if (options?.administration) {
        if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
          return DEMO_WRITE_BLOCKED_TASK_RESULT
        }

        const existing = tasks.find((item) => item.id === id)
        if (!existing) {
          return { success: false, message: "Orden de trabajo no encontrada." }
        }

        if (!usesSupabase) {
          return {
            success: false,
            message:
              "No fue posible actualizar la orden de trabajo. Intente nuevamente.",
          }
        }

        try {
          const enrichedPayload =
            await enrichUpdateTaskPayloadWithResolvedLocation(fieldsOnly)
          const updatedTask = await updateWorkOrderThroughAdminApi(
            id,
            enrichedPayload
          )

          recordTaskMutationAudit({
            before: existing,
            after: updatedTask,
            payload: enrichedPayload,
          })

          setTasks((current) => {
            const next = current.map((item) =>
              item.id === id ? updatedTask : item
            )
            if (enrichedPayload.dueDate !== undefined) {
              void applyVencidaSyncFromApi(next).then((syncedTasks) => {
                setTasks((latest) =>
                  mergeVencidaStatusIntoTasks(latest, syncedTasks)
                )
              })
            }
            return next
          })
          setDetailVersion((version) => version + 1)
          return { success: true, task: updatedTask }
        } catch (error) {
          logOperationError("TASK ADMIN UPDATE", error)
          return {
            success: false,
            message:
              error instanceof Error
                ? error.message
                : "No fue posible actualizar la orden de trabajo. Intente nuevamente.",
          }
        }
      }

      return updateTaskFields(id, fieldsOnly)
    },
    [
      tasks,
      usesSupabase,
      isReadOnly,
      openRestrictedDialog,
      updateTaskFields,
    ]
  )

  const applyExecutionOrderUpdates = useCallback(
    async (updates: ExecutionOrderUpdate[]): Promise<TaskMutationResult> => {
      const plan = buildExecutionOrderPersistPlan(updates, tasks)

      for (const phase of plan.phases) {
        for (const update of phase) {
          const result = await editTask(update.taskId, {
            executionOrder: update.executionOrder,
          })

          if (!result.success) {
            return result
          }
        }
      }

      return { success: true }
    },
    [tasks, editTask]
  )

  const applyDispatchOrderUpdates = useCallback(
    async (
      updates: Array<{ taskId: string; dispatchOrder: number | null }>
    ): Promise<TaskMutationResult> => {
      const plan = buildDispatchOrderPersistPlan(updates, tasks)

      for (const phase of plan.phases) {
        for (const update of phase) {
          const result = await editTask(update.taskId, {
            dispatchOrder: update.dispatchOrder,
          })

          if (!result.success) {
            return result
          }
        }
      }

      return { success: true }
    },
    [tasks, editTask]
  )

  const applyWorkflowTransition = useCallback(
    async (
      id: string,
      workflowAction: TaskWorkflowAction,
      options?: {
        evidenceCount?: number
        stepPhotoCounts?: Record<string, number>
        historyNote?: string
      }
    ): Promise<TaskMutationResult> => {
      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      const validation = canPerformTaskAction(task, workflowAction, {
        evidenceCount: options?.evidenceCount,
        stepPhotoCounts: options?.stepPhotoCounts,
      })
      if (!validation.allowed) {
        return { success: false, message: validation.message }
      }

      const { to } = getTransitionForAction(workflowAction)
      const fields: UpdateTaskPayload = { status: to }

      if (
        workflowAction === "submit-for-approval" ||
        workflowAction === "approve"
      ) {
        fields.rejectionReason = ""
      }

      return updateTaskFields(
        id,
        fields,
        workflowAction,
        options?.historyNote
      )
    },
    [tasks, updateTaskFields]
  )

  const changeTaskStatus = useCallback(
    async (id: string, targetStatus: TaskStatus): Promise<TaskMutationResult> => {
      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      if (targetStatus === task.status) {
        return { success: false, message: "La orden de trabajo ya está en ese estado." }
      }

      const action = getWorkflowActionForTargetStatus(task.status, targetStatus)
      if (!action) {
        return { success: false, message: "Transición no permitida." }
      }

      return applyWorkflowTransition(id, action)
    },
    [tasks, applyWorkflowTransition]
  )

  const startTask = useCallback(
    (id: string) => applyWorkflowTransition(id, "start"),
    [applyWorkflowTransition]
  )

  const submitTaskForApproval = useCallback(
    async (id: string) => {
      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      if (hasOperationalSteps(task)) {
        const stepCountsResult = await getOperationalStepPhotoCounts(id)
        const stepPhotoCounts = stepCountsResult.data ?? {}

        return applyWorkflowTransition(id, "submit-for-approval", {
          stepPhotoCounts,
        })
      }

      const evidenceResult = await getTaskEvidencePhotoCount(id)
      const evidenceCount = evidenceResult.data ?? 0

      return applyWorkflowTransition(id, "submit-for-approval", {
        evidenceCount,
      })
    },
    [tasks, applyWorkflowTransition]
  )

  const approveTask = useCallback(
    async (id: string): Promise<TaskMutationResult> => {
      const result = await applyWorkflowTransition(id, "approve")

      if (result.success && result.task) {
        await applyWorkOrderApprovalEffects(result.task)
      }

      return result
    },
    [applyWorkflowTransition]
  )

  const rejectTask = useCallback(
    async (id: string, reason: string) => {
      const trimmedReason = reason.trim()
      if (!trimmedReason) {
        return {
          success: false,
          message: "Indique el motivo de rechazo.",
        }
      }

      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      const validation = canPerformTaskAction(task, "reject")
      if (!validation.allowed) {
        return { success: false, message: validation.message }
      }

      const { to } = getTransitionForAction("reject")
      return updateTaskFields(
        id,
        { status: to, rejectionReason: trimmedReason },
        "reject",
        `Motivo: ${trimmedReason}`
      )
    },
    [tasks, updateTaskFields]
  )

  const closeTask = useCallback(
    (id: string) => applyWorkflowTransition(id, "close"),
    [applyWorkflowTransition]
  )

  const cancelTask = useCallback(
    async (
      id: string,
      options?: {
        reason: string
        observation: string
        actor?: string
      }
    ): Promise<TaskMutationResult> => {
      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      const reason = options?.reason.trim() ?? ""
      const observation = options?.observation.trim() ?? ""

      if (!reason) {
        return { success: false, message: "Indique el motivo de cancelación." }
      }

      if (!observation) {
        return {
          success: false,
          message: "Indique la observación de cancelación.",
        }
      }

      const validation = canPerformTaskAction(task, "cancel")
      if (!validation.allowed) {
        return { success: false, message: validation.message }
      }

      const { to } = getTransitionForAction("cancel")
      const historyNote = [
        `Motivo: ${resolveIncidentReasonLabel(reason)}`,
        `Observación: ${observation}`,
      ].join("\n")

      const crewId = resolveTaskCrewId(task)
      if (crewId && isOperationalOrderReorderable(task)) {
        const orderUpdates = buildOperationalOrderRemovalUpdates({
          tasks,
          dueDate: task.dueDate,
          crewId,
          removedTaskId: id,
          crews: [],
        })

        if (orderUpdates.length > 0) {
          const orderResult = await applyExecutionOrderUpdates(orderUpdates)
          if (!orderResult.success) {
            return orderResult
          }
        }
      }

      return updateTaskFields(
        id,
        {
          status: to,
          cancellationReason: reason,
          cancellationObservation: observation,
        },
        "cancel",
        historyNote,
        options?.actor
      )
    },
    [tasks, updateTaskFields, applyExecutionOrderUpdates]
  )

  const reportTaskIncident = useCallback(
    async (
      id: string,
      input: {
        reason: string
        observation: string
        reportedBy: string
      }
    ): Promise<TaskMutationResult> => {
      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      const reason = input.reason.trim()
      const observation = input.observation.trim()
      const reportedBy = input.reportedBy.trim()

      if (!reason) {
        return { success: false, message: "Seleccione un motivo de incidencia." }
      }

      if (!observation) {
        return {
          success: false,
          message: "Describa brevemente la situación.",
        }
      }

      const validation = canPerformTaskAction(task, "report-incident")
      if (!validation.allowed) {
        return { success: false, message: validation.message }
      }

      const { to } = getTransitionForAction("report-incident")
      const historyNote = [
        `Motivo: ${resolveIncidentReasonLabel(reason)}`,
        `Observación: ${observation}`,
      ].join("\n")

      return updateTaskFields(
        id,
        {
          status: to,
          incidentReason: reason,
          incidentObservation: observation,
          incidentReportedAt: new Date().toISOString(),
          incidentReportedBy: reportedBy,
        },
        "report-incident",
        historyNote,
        reportedBy
      )
    },
    [tasks, updateTaskFields]
  )

  const resumeTaskFromIncident = useCallback(
    async (id: string, actor?: string): Promise<TaskMutationResult> => {
      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      const validation = canPerformTaskAction(task, "resume-from-incident")
      if (!validation.allowed) {
        return { success: false, message: validation.message }
      }

      const { to } = getTransitionForAction("resume-from-incident")
      return updateTaskFields(
        id,
        { status: to },
        "resume-from-incident",
        "La orden de trabajo volvió a En curso para continuar la ejecución.",
        actor
      )
    },
    [tasks, updateTaskFields]
  )

  const applyTaskReschedule = useCallback(
    async (
      id: string,
      workflowAction: Extract<
        TaskWorkflowAction,
        "reschedule-from-incident" | "reschedule-from-overdue"
      >,
      input: TaskRescheduleInput & { actor?: string }
    ): Promise<TaskMutationResult> => {
      const task = tasks.find((item) => item.id === id)
      if (!task) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      const validation = canPerformTaskAction(task, workflowAction)
      if (!validation.allowed) {
        return { success: false, message: validation.message }
      }

      const scheduleValidation = validateTaskRescheduleInput({
        dueDate: input.dueDate,
        scheduledTime: input.scheduledTime,
        reason: input.reason,
      })

      if (!scheduleValidation.allowed) {
        return {
          success: false,
          message: scheduleValidation.message,
        }
      }

      const rescheduledBy = input.rescheduledBy.trim() || input.actor?.trim() || ""
      if (!rescheduledBy) {
        return {
          success: false,
          message: "No se pudo identificar al usuario que reprograma.",
        }
      }

      const { to } = getTransitionForAction(workflowAction)
      const targetStatus =
        workflowAction === "reschedule-from-overdue"
          ? getInitialTaskStatus({
              crewId: input.crewId ?? task.crewId,
              crew: input.crew ?? task.crew,
            })
          : to
      const rescheduleInput: TaskRescheduleInput = {
        ...input,
        rescheduledBy,
      }
      const updatePayload = buildTaskRescheduleUpdatePayload(
        task,
        rescheduleInput,
        targetStatus
      )

      const nextDueDate = updatePayload.dueDate ?? task.dueDate
      const nextCrewId =
        updatePayload.crewId !== undefined
          ? updatePayload.crewId
          : resolveTaskCrewId(task)

      if (
        nextDueDate !== task.dueDate &&
        nextCrewId &&
        isOperationalOrderReorderable(task)
      ) {
        const orderUpdates = resolveOperationalOrderOnDateChange({
          task,
          newDueDate: nextDueDate,
          allTasks: tasks,
          crews: [],
        })

        if (orderUpdates.length > 0) {
          const orderResult = await applyExecutionOrderUpdates(orderUpdates)
          if (!orderResult.success) {
            return orderResult
          }
        }

        const taskOrderUpdate = orderUpdates.find((update) => update.taskId === id)
        if (taskOrderUpdate) {
          updatePayload.executionOrder = taskOrderUpdate.executionOrder
        }
      }

      return updateTaskFields(
        id,
        updatePayload,
        workflowAction,
        buildTaskRescheduleHistoryNote(rescheduleInput),
        rescheduledBy,
        { rescheduleInput }
      )
    },
    [tasks, updateTaskFields, applyExecutionOrderUpdates]
  )

  const rescheduleTaskFromIncident = useCallback(
    async (
      id: string,
      input: TaskRescheduleInput & { actor?: string }
    ): Promise<TaskMutationResult> => {
      return applyTaskReschedule(id, "reschedule-from-incident", input)
    },
    [applyTaskReschedule]
  )

  const rescheduleTaskFromOverdue = useCallback(
    async (
      id: string,
      input: TaskRescheduleInput & { actor?: string }
    ): Promise<TaskMutationResult> => {
      return applyTaskReschedule(id, "reschedule-from-overdue", input)
    },
    [applyTaskReschedule]
  )

  const assignCrew = useCallback(
    async (
      id: string,
      crewId: string | null,
      crewName = "",
      supervisor = "",
      options?: { promoteToAssigned?: boolean }
    ): Promise<TaskMutationResult> => {
      const existing = tasks.find((item) => item.id === id)
      if (!existing) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      const payload: UpdateTaskPayload = {
        crewId,
        crew: crewName,
        supervisor: crewId ? supervisor : "",
      }

      const nextStatus = resolveStatusAfterCrewAssignment(
        existing.status,
        crewId,
        crewName,
        options
      )

      if (nextStatus) {
        const validation = canPerformTaskAction(existing, "assign-crew")
        if (!validation.allowed) {
          return { success: false, message: validation.message }
        }

        return updateTaskFields(
          id,
          { ...payload, status: nextStatus },
          "assign-crew"
        )
      }

      return updateTaskFields(id, payload)
    },
    [tasks, updateTaskFields]
  )

  const confirmPlanningTasks = useCallback(
    async (ids: string[]): Promise<TaskMutationResult> => {
      if (ids.length === 0) {
        return {
          success: false,
          message: "No hay órdenes de trabajo programadas para confirmar.",
        }
      }

      const dispatchUpdates = buildDispatchOrderConfirmUpdates(tasks, ids)
      const dispatchResult = await applyDispatchOrderUpdates(dispatchUpdates)
      if (!dispatchResult.success) {
        return dispatchResult
      }

      for (const id of ids) {
        const task = tasks.find((item) => item.id === id)
        if (!task) {
          return { success: false, message: "Orden de trabajo no encontrada." }
        }

        const validation = canPerformTaskAction(task, "confirm-planning")
        if (!validation.allowed) {
          return { success: false, message: validation.message }
        }

        const result = await updateTaskFields(
          id,
          {
            status: "asignada",
          },
          "confirm-planning",
          "Planificación confirmada para la jornada.",
          undefined,
          { suppressAudit: true }
        )

        if (!result.success) {
          return result
        }
      }

      return { success: true }
    },
    [tasks, updateTaskFields, applyDispatchOrderUpdates]
  )

  const reopenPlanningTasks = useCallback(
    async (ids: string[]): Promise<TaskMutationResult> => {
      if (ids.length === 0) {
        return {
          success: false,
          message: "No hay órdenes de trabajo para reabrir la planificación.",
        }
      }

      for (const id of ids) {
        const task = tasks.find((item) => item.id === id)
        if (!task) {
          return { success: false, message: "Orden de trabajo no encontrada." }
        }

        const validation = canPerformTaskAction(task, "reopen-planning")
        if (!validation.allowed) {
          return { success: false, message: validation.message }
        }

        const result = await updateTaskFields(
          id,
          { status: "programada", dispatchOrder: null },
          "reopen-planning",
          "Planificación reabierta para edición.",
          undefined,
          { suppressAudit: true }
        )

        if (!result.success) {
          return result
        }
      }

      return { success: true }
    },
    [tasks, updateTaskFields]
  )

  const deleteTask = useCallback(
    async (
      id: string,
      options?: TaskMutationOptions
    ): Promise<TaskMutationResult> => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return DEMO_WRITE_BLOCKED_TASK_RESULT
      }

      const existing = tasks.find((item) => item.id === id)
      if (!existing) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      logDeleteTrace("provider.deleteTask", {
        entity: "task",
        id,
        code: existing.code,
      })

      if (options?.administration) {
        if (!usesSupabase) {
          return { success: false, message: TASK_DELETE_USER_MESSAGE }
        }

        try {
          await deleteWorkOrderThroughAdminApi(id)
        } catch (error) {
          console.error("[TASK ADMIN DELETE]", error)
          return {
            success: false,
            message:
              error instanceof Error
                ? error.message
                : TASK_DELETE_USER_MESSAGE,
          }
        }

        setTasks((current) => current.filter((item) => item.id !== id))
        detailCache.delete(id)
        setDetailVersion((version) => version + 1)
        recordTaskDeleteAudit(existing)

        return { success: true }
      }

      if (!canArchiveTaskByStatus(existing.status)) {
        return {
          success: false,
          message: TASK_ARCHIVE_BLOCKED_ACTIVE_MESSAGE,
        }
      }

      if (!usesSupabase) {
        return { success: false, message: TASK_DELETE_USER_MESSAGE }
      }

      try {
        const client = createBrowserTasksClient()
        const result = await deleteTaskInSupabase(id, client)

        if (result.error) {
          console.error("[TASK DELETE]", result.error)
          return {
            success: false,
            message: result.error.message ?? TASK_DELETE_USER_MESSAGE,
          }
        }
      } catch (error) {
        console.error("[TASK DELETE]", error)
        return {
          success: false,
          message: TASK_DELETE_USER_MESSAGE,
        }
      }

      setTasks((current) => current.filter((item) => item.id !== id))
      detailCache.delete(id)
      setDetailVersion((version) => version + 1)
      recordTaskDeleteAudit(existing)

      return { success: true }
    },
    [tasks, usesSupabase, isReadOnly, openRestrictedDialog]
  )

  const removeTaskLocally = useCallback((id: string) => {
    setTasks((current) => current.filter((item) => item.id !== id))
    detailCache.delete(id)
    setDetailVersion((version) => version + 1)
  }, [])

  const removeTasksByCustomerId = useCallback((customerId: string) => {
    setTasks((current) => {
      for (const task of current) {
        if (task.customerId === customerId) {
          detailCache.delete(task.id)
        }
      }

      return current.filter((item) => item.customerId !== customerId)
    })
    setDetailVersion((version) => version + 1)
  }, [])

  const getTask = useCallback(
    (id: string) => tasks.find((task) => task.id === id),
    [tasks]
  )

  const getDetail = useCallback(
    (id: string) => {
      if (detailCache.has(id)) {
        return detailCache.get(id)
      }

      const task = tasks.find((item) => item.id === id)
      if (!task) return undefined

      const detail = getTaskDetail(task)
      cacheDetail(id, detail)
      return detail
    },
    [tasks]
  )

  const toggleChecklistItem = useCallback(
    (taskId: string, itemId: string) => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return
      }

      let updatedTask: Task | undefined

      setTasks((current) =>
        current.map((task) => {
          if (task.id !== taskId) return task

          const checklist = task.checklist.map((item) =>
            item.id === itemId ? { ...item, completed: !item.completed } : item
          )

          updatedTask = syncTaskProgress({ ...task, checklist })
          return updatedTask
        })
      )

      if (updatedTask) {
        void persistTaskUpdate(updatedTask)
      }
    },
    [persistTaskUpdate, isReadOnly, openRestrictedDialog]
  )

  const syncOperationalStepsProgress = useCallback(
    async (taskId: string, stepPhotoCounts: Record<string, number>) => {
      const task = tasks.find((item) => item.id === taskId)
      if (!task || !hasOperationalSteps(task)) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      const operationalSteps = syncOperationalStepsWithPhotoCounts(
        task.operationalSteps ?? [],
        stepPhotoCounts
      )
      const progress = getOperationalStepsProgress(
        operationalSteps,
        stepPhotoCounts
      )

      return updateTaskFields(taskId, { operationalSteps, progress })
    },
    [tasks, updateTaskFields]
  )

  const updateOperationalStepObservation = useCallback(
    async (taskId: string, stepId: string, observation: string) => {
      const task = tasks.find((item) => item.id === taskId)
      if (!task || !hasOperationalSteps(task)) {
        return { success: false, message: "Orden de trabajo no encontrada." }
      }

      const withObservation = (task.operationalSteps ?? []).map((step) =>
        step.id === stepId ? { ...step, observation } : step
      )

      const stepCountsResult = await getOperationalStepPhotoCounts(taskId)
      const stepPhotoCounts = stepCountsResult.data ?? {}

      const operationalSteps = syncOperationalStepsWithPhotoCounts(
        withObservation,
        stepPhotoCounts
      )
      const progress = getOperationalStepsProgress(
        operationalSteps,
        stepPhotoCounts
      )

      return updateTaskFields(taskId, { operationalSteps, progress })
    },
    [tasks, updateTaskFields]
  )

  const addComment = useCallback(
    (
      taskId: string,
      content: string,
      author = "Operario",
      role: TaskDetail["comments"][number]["role"] = "operario"
    ) => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return
      }

      const task = tasks.find((item) => item.id === taskId)
      if (!task) return

      const detail = detailCache.get(taskId) ?? getTaskDetail(task)

      cacheDetail(taskId, {
        ...detail,
        comments: [
          ...detail.comments,
          {
            id: `cm-${Date.now()}`,
            author,
            role,
            content,
            timestamp: new Date().toISOString(),
          },
        ],
      })
      setDetailVersion((version) => version + 1)
    },
    [tasks, isReadOnly, openRestrictedDialog]
  )

  const addEvidence = useCallback(
    (taskId: string, title: string, uploadedBy = "Operario") => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return
      }

      const task = tasks.find((item) => item.id === taskId)
      if (!task) return

      const detail = detailCache.get(taskId) ?? getTaskDetail(task)

      cacheDetail(taskId, {
        ...detail,
        evidence: [
          {
            id: `ev-${Date.now()}`,
            title,
            type: "photo",
            uploadedBy,
            uploadedAt: new Date().toISOString(),
          },
          ...detail.evidence,
        ],
        history: [
          {
            id: `h-${Date.now()}`,
            action: "Foto cargada",
            description: title,
            user: uploadedBy,
            timestamp: new Date().toISOString(),
          },
          ...detail.history,
        ],
      })
      setDetailVersion((version) => version + 1)
    },
    [tasks, isReadOnly, openRestrictedDialog]
  )

  const value = useMemo(
    () => ({
      tasks,
      isTasksReady,
      usesSupabase,
      detailVersion,
      getTask,
      getDetail,
      addTask,
      editTask,
      changeTaskStatus,
      assignCrew,
      deleteTask,
      removeTaskLocally,
      removeTasksByCustomerId,
      startTask,
      submitTaskForApproval,
      approveTask,
      rejectTask,
      closeTask,
      cancelTask,
      confirmPlanningTasks,
      reopenPlanningTasks,
      reportTaskIncident,
      resumeTaskFromIncident,
      rescheduleTaskFromIncident,
      rescheduleTaskFromOverdue,
      toggleChecklistItem,
      syncOperationalStepsProgress,
      updateOperationalStepObservation,
      addComment,
      addEvidence,
      refreshTasksFromServer,
    }),
    [
      tasks,
      isTasksReady,
      usesSupabase,
      detailVersion,
      getTask,
      getDetail,
      addTask,
      editTask,
      changeTaskStatus,
      assignCrew,
      deleteTask,
      removeTaskLocally,
      removeTasksByCustomerId,
      startTask,
      submitTaskForApproval,
      approveTask,
      rejectTask,
      closeTask,
      cancelTask,
      confirmPlanningTasks,
      reopenPlanningTasks,
      reportTaskIncident,
      resumeTaskFromIncident,
      rescheduleTaskFromIncident,
      rescheduleTaskFromOverdue,
      toggleChecklistItem,
      syncOperationalStepsProgress,
      updateOperationalStepObservation,
      addComment,
      addEvidence,
      refreshTasksFromServer,
    ]
  )

  return (
    <TasksContext.Provider value={value}>
      {isTasksReady ? children : null}
    </TasksContext.Provider>
  )
}

export function useTasks() {
  const context = useContext(TasksContext)
  if (!context) {
    throw new Error("useTasks must be used within TasksProvider")
  }
  return context
}

export { getChecklistProgress } from "@/lib/tasks/utils"
