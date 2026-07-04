"use client"

import { TaskAdminDetailHeader } from "@/components/tareas/task-admin-detail-header"
import { TaskAdminInfoPanel } from "@/components/tareas/task-admin-info-panel"
import { TaskAdminSidebarPanel } from "@/components/tareas/task-admin-sidebar-panel"
import { TaskAdminWorkflowPanel } from "@/components/tareas/task-admin-workflow-panel"
import type { Task, TaskDetail } from "@/lib/types/tasks"

type TaskAdminDetailViewProps = {
  task: Task
  detail: TaskDetail
}

export function TaskAdminDetailView({ task }: TaskAdminDetailViewProps) {
  return (
    <div className="space-y-6">
      <TaskAdminDetailHeader task={task} />

      <TaskAdminWorkflowPanel task={task} />

      <div className="grid gap-6 lg:grid-cols-3">
        <TaskAdminInfoPanel task={task} />
        <TaskAdminSidebarPanel task={task} />
      </div>
    </div>
  )
}
