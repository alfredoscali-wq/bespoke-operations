"use client"

import { TaskAdminArchivePermanentDelete } from "@/components/tareas/task-admin-archive-permanent-delete"
import { TaskAdminDetailHeader } from "@/components/tareas/task-admin-detail-header"
import { TaskAdminInfoPanel } from "@/components/tareas/task-admin-info-panel"
import { TaskAdminSidebarPanel } from "@/components/tareas/task-admin-sidebar-panel"
import { TaskAdminWorkflowPanel } from "@/components/tareas/task-admin-workflow-panel"
import type { Task, TaskDetail } from "@/lib/types/tasks"

type TaskAdminDetailViewProps = {
  task: Task
  detail: TaskDetail
  backHref?: string
  embedded?: boolean
  showWorkflowPanel?: boolean
  showPermanentDelete?: boolean
  onPermanentDeleteSuccess?: (message: string) => void
}

export function TaskAdminDetailView({
  task,
  backHref,
  embedded = false,
  showWorkflowPanel = false,
  showPermanentDelete = false,
  onPermanentDeleteSuccess,
}: TaskAdminDetailViewProps) {
  return (
    <div className="space-y-6">
      <TaskAdminDetailHeader
        task={task}
        backHref={backHref}
        embedded={embedded}
      />

      {showWorkflowPanel ? <TaskAdminWorkflowPanel task={task} /> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <TaskAdminInfoPanel task={task} />
        <TaskAdminSidebarPanel task={task} />
      </div>

      {showPermanentDelete && onPermanentDeleteSuccess ? (
        <TaskAdminArchivePermanentDelete
          task={task}
          onSuccess={onPermanentDeleteSuccess}
        />
      ) : null}
    </div>
  )
}
