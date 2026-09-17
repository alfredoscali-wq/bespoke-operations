"use client"

import { useMemo } from "react"

import { useDemoMode } from "@/components/demo/demo-mode-provider"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import type { OperarioWebCrewRef } from "@/lib/tasks/task-list-scope"

import { TasksContext } from "./context"
import { useTasksCreate } from "./hooks/use-tasks-create"
import { useTasksDeletion } from "./hooks/use-tasks-deletion"
import { useTasksDetail } from "./hooks/use-tasks-detail"
import { useTasksIncidents } from "./hooks/use-tasks-incidents"
import {
  useTasksLoad,
  type TasksListScope,
} from "./hooks/use-tasks-load"
import { useTasksPlanning } from "./hooks/use-tasks-planning"
import { useTasksUpdate } from "./hooks/use-tasks-update"
import { useTasksWorkflow } from "./hooks/use-tasks-workflow"

export function TasksProvider({
  children,
  listScope = "all",
  operarioCrew,
  isOperarioCrewReady,
}: {
  children: React.ReactNode
  listScope?: TasksListScope
  operarioCrew?: OperarioWebCrewRef
  isOperarioCrewReady?: boolean
}) {
  const { isReadOnly, openRestrictedDialog } = useDemoMode()
  const { companyId, isAuthReady } = useTenantCompanyId()

  const {
    tasks,
    setTasks,
    isTasksReady,
    usesSupabase,
    usesSupabaseRef,
    detailVersion,
    setDetailVersion,
    refreshTasksFromServer,
    mergeFetchedTask,
    archiveList,
    dashboardFinalizadaCount,
    dashboardProjectMetricTasks,
  } = useTasksLoad({
    companyId,
    isAuthReady,
    listScope,
    operarioCrew,
    isOperarioCrewReady,
  })

  const {
    persistTaskUpdate,
    updateTaskFields,
    editTask,
    applyExecutionOrderUpdates,
  } = useTasksUpdate({
    tasks,
    setTasks,
    usesSupabase,
    usesSupabaseRef,
    isReadOnly,
    openRestrictedDialog,
    setDetailVersion,
  })

  const { addTask } = useTasksCreate({
    tasks,
    setTasks,
    usesSupabase,
    companyId,
    isReadOnly,
    openRestrictedDialog,
  })

  const {
    changeTaskStatus,
    startTask,
    submitTaskForApproval,
    approveTask,
    rejectTask,
    assignCrew,
  } = useTasksWorkflow({ companyId, tasks, updateTaskFields })

  const { confirmPlanningTasks, reopenPlanningTasks, returnPlanningTaskToAtencion } = useTasksPlanning({
    companyId,
    tasks,
    updateTaskFields,
    applyExecutionOrderUpdates,
  })

  const {
    cancelTask,
    reportTaskIncident,
    resumeTaskFromIncident,
    rescheduleTaskFromIncident,
    rescheduleTaskFromOverdue,
    reschedulePlanningReturnedTask,
    rescheduleProjectTask,
    resolveProjectTaskIncident,
    releaseProjectTaskToField,
    returnProjectTaskFromField,
  } = useTasksIncidents({
    companyId,
    tasks,
    updateTaskFields,
    applyExecutionOrderUpdates,
  })

  const { deleteTask, removeTaskLocally, removeTasksByCustomerId } =
    useTasksDeletion({
      tasks,
      setTasks,
      usesSupabase,
      isReadOnly,
      openRestrictedDialog,
      setDetailVersion,
      applyExecutionOrderUpdates,
    })

  const {
    getTask,
    getDetail,
    toggleChecklistItem,
    syncOperationalStepsProgress,
    updateOperationalStepObservation,
    addComment,
    addEvidence,
  } = useTasksDetail({
    tasks,
    setTasks,
    isReadOnly,
    openRestrictedDialog,
    setDetailVersion,
    persistTaskUpdate,
    updateTaskFields,
  })

  const value = useMemo(
    () => ({
      tasks,
      isTasksReady,
      usesSupabase,
      detailVersion,
      archiveList,
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
      cancelTask,
      confirmPlanningTasks,
      reopenPlanningTasks,
      returnPlanningTaskToAtencion,
      applyExecutionOrderUpdates,
      reportTaskIncident,
      resumeTaskFromIncident,
      rescheduleTaskFromIncident,
      rescheduleTaskFromOverdue,
      reschedulePlanningReturnedTask,
      rescheduleProjectTask,
      resolveProjectTaskIncident,
      releaseProjectTaskToField,
      returnProjectTaskFromField,
      toggleChecklistItem,
      syncOperationalStepsProgress,
      updateOperationalStepObservation,
      addComment,
      addEvidence,
      refreshTasksFromServer,
      mergeFetchedTask,
      dashboardFinalizadaCount,
      dashboardProjectMetricTasks,
    }),
    [
      tasks,
      isTasksReady,
      usesSupabase,
      detailVersion,
      archiveList,
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
      cancelTask,
      confirmPlanningTasks,
      reopenPlanningTasks,
      returnPlanningTaskToAtencion,
      applyExecutionOrderUpdates,
      reportTaskIncident,
      resumeTaskFromIncident,
      rescheduleTaskFromIncident,
      rescheduleTaskFromOverdue,
      reschedulePlanningReturnedTask,
      rescheduleProjectTask,
      resolveProjectTaskIncident,
      releaseProjectTaskToField,
      returnProjectTaskFromField,
      toggleChecklistItem,
      syncOperationalStepsProgress,
      updateOperationalStepObservation,
      addComment,
      addEvidence,
      refreshTasksFromServer,
      mergeFetchedTask,
      dashboardFinalizadaCount,
      dashboardProjectMetricTasks,
    ]
  )

  return (
    <TasksContext.Provider value={value}>
      {isTasksReady ? children : null}
    </TasksContext.Provider>
  )
}
