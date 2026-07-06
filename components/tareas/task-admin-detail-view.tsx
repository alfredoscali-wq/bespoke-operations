"use client"

import { TaskAdminArchivePermanentDelete } from "@/components/tareas/task-admin-archive-permanent-delete"
import { TaskAdminDetailHeader } from "@/components/tareas/task-admin-detail-header"
import { TaskAdminIncidentRecordPanel } from "@/components/tareas/task-admin-incident-record-panel"
import { TaskAdminInfoPanel } from "@/components/tareas/task-admin-info-panel"
import { TaskAdminSidebarPanel } from "@/components/tareas/task-admin-sidebar-panel"
import { TaskAdminWorkflowPanel } from "@/components/tareas/task-admin-workflow-panel"
import type { IncidentResponse } from "@/lib/types/task-incidents"
import type { Task, TaskDetail } from "@/lib/types/tasks"

type TaskAdminDetailViewProps = {
  task: Task
  detail: TaskDetail
  backHref?: string
  embedded?: boolean
  showWorkflowPanel?: boolean
  showPermanentDelete?: boolean
  onPermanentDeleteSuccess?: (message: string) => void
  incident?: IncidentResponse | null
  incidentTypeLabel?: string
  isIncidentDetailLoading?: boolean
}

export function TaskAdminDetailView({
  task,
  backHref,
  embedded = false,
  showWorkflowPanel = false,
  showPermanentDelete = false,
  onPermanentDeleteSuccess,
  incident = null,
  incidentTypeLabel = "—",
  isIncidentDetailLoading = false,
}: TaskAdminDetailViewProps) {
  return (
    <div className="space-y-6">
      <TaskAdminDetailHeader
        task={task}
        backHref={backHref}
        embedded={embedded}
      />

      {showWorkflowPanel ? <TaskAdminWorkflowPanel task={task} /> : null}

      {incident || isIncidentDetailLoading ? (
        <TaskAdminIncidentRecordPanel
          incident={incident}
          incidentTypeLabel={incidentTypeLabel}
          isLoading={isIncidentDetailLoading}
        />
      ) : null}

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
