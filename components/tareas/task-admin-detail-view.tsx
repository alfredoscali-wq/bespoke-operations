"use client"

import { TaskAdminArchivePermanentDelete } from "@/components/tareas/task-admin-archive-permanent-delete"
import { TaskAdminDetailHeader } from "@/components/tareas/task-admin-detail-header"
import { TaskAdminIncidentRecordPanel } from "@/components/tareas/task-admin-incident-record-panel"
import { TaskAdminInfoPanel } from "@/components/tareas/task-admin-info-panel"
import { TaskAdminSidebarPanel } from "@/components/tareas/task-admin-sidebar-panel"
import { TaskAdminSoftDeleteAction } from "@/components/tareas/task-admin-soft-delete-action"
import { TaskAdminWorkflowPanel } from "@/components/tareas/task-admin-workflow-panel"
import { TaskCancellationRecordPanel } from "@/components/tareas/task-cancellation-record-panel"
import { TaskOperationalTimeline } from "@/components/tareas/task-operational-timeline"
import type { IncidentResponse } from "@/lib/types/task-incidents"
import type { Task, TaskDetail } from "@/lib/types/tasks"

type TaskAdminDetailViewProps = {
  task: Task
  detail: TaskDetail
  embedded?: boolean
  showWorkflowPanel?: boolean
  showPermanentDelete?: boolean
  onPermanentDeleteSuccess?: (message: string) => void
  incident?: IncidentResponse | null
  incidentTypeLabel?: string
  isIncidentDetailLoading?: boolean
  timelineRefreshKey?: number | string
}

export function TaskAdminDetailView({
  task,
  detail,
  embedded = false,
  showWorkflowPanel = false,
  showPermanentDelete = false,
  onPermanentDeleteSuccess,
  incident = null,
  incidentTypeLabel = "—",
  isIncidentDetailLoading = false,
  timelineRefreshKey = 0,
}: TaskAdminDetailViewProps) {
  return (
    <div className="space-y-6">
      <TaskAdminDetailHeader task={task} embedded={embedded} />

      {showWorkflowPanel ? <TaskAdminWorkflowPanel task={task} /> : null}

      <TaskCancellationRecordPanel
        task={task}
        relatedIncidentLabel={
          incident
            ? `${incidentTypeLabel} · ${incident.id.slice(0, 8)}`
            : task.incidentReason || null
        }
      />

      {incident || isIncidentDetailLoading ? (
        <TaskAdminIncidentRecordPanel
          incident={incident}
          incidentTypeLabel={incidentTypeLabel}
          isLoading={isIncidentDetailLoading}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <TaskAdminInfoPanel task={task} embedded={embedded} />
        <TaskAdminSidebarPanel task={task} />
      </div>

      <TaskOperationalTimeline
        taskId={task.id}
        refreshKey={timelineRefreshKey}
      />

      {showPermanentDelete && onPermanentDeleteSuccess ? (
        <TaskAdminArchivePermanentDelete
          task={task}
          onSuccess={onPermanentDeleteSuccess}
        />
      ) : !embedded ? (
        <TaskAdminSoftDeleteAction task={task} />
      ) : null}
    </div>
  )
}
