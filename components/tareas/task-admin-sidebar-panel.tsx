"use client"

import { useTasks } from "@/components/tareas/tasks-provider"
import { TaskAdminReferencePhotos } from "@/components/tareas/task-admin-reference-photos"
import type { Task } from "@/lib/types/tasks"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TaskAdminSidebarPanelProps = {
  task: Task
}

function resolveAdminObservations(task: Task): string {
  return (
    task.observationsForCrew?.trim() ||
    task.description?.trim() ||
    "Sin observaciones"
  )
}

export function TaskAdminSidebarPanel({ task }: TaskAdminSidebarPanelProps) {
  const { getTask } = useTasks()
  const liveTask = getTask(task.id) ?? task
  const observations = resolveAdminObservations(liveTask)

  return (
    <div className="space-y-4">
      <TaskAdminReferencePhotos taskId={liveTask.id} compact />

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Observaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {observations}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
