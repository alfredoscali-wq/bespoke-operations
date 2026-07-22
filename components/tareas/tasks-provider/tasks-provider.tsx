"use client"

import { useMemo } from "react"

import { useDemoMode } from "@/components/demo/demo-mode-provider"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"

import { TasksContext } from "./context"
import { useTasksCreate } from "./hooks/use-tasks-create"
import { useTasksDeletion } from "./hooks/use-tasks-deletion"
import { useTasksDetail } from "./hooks/use-tasks-detail"
import { useTasksIncidents } from "./hooks/use-tasks-incidents"
import { useTasksLoad } from "./hooks/use-tasks-load"
import { useTasksPlanning } from "./hooks/use-tasks-planning"
import { useTasksUpdate } from "./hooks/use-tasks-update"
import { useTasksWorkflow } from "./hooks/use-tasks-workflow"

export function TasksProvider({ children }: { children: React.ReactNode }) {
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
  } = useTasksLoad({ companyId, isAuthReady })

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
