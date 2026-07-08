"use client"

import { useState } from "react"

import { useAuth } from "@/components/auth/auth-provider"
import { TaskClosureRejectDialog } from "@/components/tareas/task-closure-reject-dialog"
import { TaskOperationalWorkflowActions } from "@/components/tareas/task-operational-workflow-actions"
import { useTasks } from "@/components/tareas/tasks-provider"
import { canUseWorkOrdersWebOperationalActions } from "@/lib/roles/web-module-access"
import { isPendingClosureStatus } from "@/lib/tasks/task-status-workflow"
import type { Task } from "@/lib/types/tasks"

type TaskAdminWorkflowPanelProps = {
  task: Task
}

export function TaskAdminWorkflowPanel({ task }: TaskAdminWorkflowPanelProps) {
  const { sessionUser } = useAuth()
  const {
    approveTask,
    rejectTask,
    cancelTask,
    resumeTaskFromIncident,
    rescheduleTaskFromIncident,
    rescheduleTaskFromOverdue,
  } = useTasks()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const canClose = canUseWorkOrdersWebOperationalActions(sessionUser)
  const actorName = sessionUser?.displayName?.trim() || "Supervisor"

  const showPanel =
    canClose &&
    (isPendingClosureStatus(task.status) ||
      task.status === "incidencia" ||
      task.status === "vencida")

  if (!showPanel) {
    return null
  }

  async function runAction(
    action: () => Promise<{ success: boolean; message?: string }>
  ) {
    setIsPending(true)
    setFeedback(null)

    try {
      const result = await action()
      if (!result.success) {
        setFeedback(result.message ?? "No fue posible completar la acción.")
      }
      return result
    } finally {
      setIsPending(false)
    }
  }

  return (
    <>
      <TaskOperationalWorkflowActions
        task={task}
        rescheduledBy={actorName}
        canClose={canClose}
        isPending={isPending}
        onClose={() => void runAction(() => approveTask(task.id))}
        onReject={() => setRejectOpen(true)}
        onResume={async () => {
          await runAction(() => resumeTaskFromIncident(task.id, actorName))
        }}
        onReschedule={async (input) => {
          await runAction(async () => {
            if (task.status === "vencida") {
              return rescheduleTaskFromOverdue(task.id, {
                ...input,
                actor: actorName,
              })
            }

            return rescheduleTaskFromIncident(task.id, {
              ...input,
              actor: actorName,
            })
          })
        }}
        onCancelIncident={async (input) => {
          await runAction(() =>
            cancelTask(task.id, {
              ...input,
              actor: actorName,
            })
          )
        }}
      />

      {feedback ? (
        <p className="text-sm text-destructive" role="alert">
          {feedback}
        </p>
      ) : null}

      <TaskClosureRejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        isSubmitting={isPending}
        onConfirm={async (reason) => {
          const result = await runAction(() => rejectTask(task.id, reason))
          if (result.success) {
            setRejectOpen(false)
          }
        }}
      />
    </>
  )
}
