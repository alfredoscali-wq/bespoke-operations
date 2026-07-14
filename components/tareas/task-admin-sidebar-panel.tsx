"use client"

import { useTasks } from "@/components/tareas/tasks-provider"
import { TaskAdminReferencePhotos } from "@/components/tareas/task-admin-reference-photos"
import { canAdminModifyWorkOrder } from "@/lib/tasks/work-order-admin-mutation"
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
    "Sin información para la cuadrilla"
  )
}

export function TaskAdminSidebarPanel({ task }: TaskAdminSidebarPanelProps) {
  const { getTask } = useTasks()
  const liveTask = getTask(task.id) ?? task
  const observations = resolveAdminObservations(liveTask)

  return (
    <div className="space-y-4">
      <TaskAdminReferencePhotos
        taskId={liveTask.id}
        compact
        canDeleteReferencePhotos={canAdminModifyWorkOrder(liveTask.status)}
      />

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Información para la Cuadrilla</CardTitle>
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
