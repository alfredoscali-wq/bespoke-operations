"use client"

import { useTasks } from "@/components/tareas/tasks-provider"
import { TaskAdminMetricCard } from "@/components/tareas/task-admin-metric-card"
import { TaskAdminReferencePhotos } from "@/components/tareas/task-admin-reference-photos"
import {
  formatAmountToCollectDisplay,
  formatContractedPlanLabel,
} from "@/lib/tasks/commercial-plan"
import {
  resolveFinalTechnologyFromTask,
  resolveTechnologyLabel,
} from "@/lib/tasks/ftth-installation"
import { isWorkOrderTask } from "@/lib/tasks/work-order"
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
  const technologyLabel =
    resolveTechnologyLabel(resolveFinalTechnologyFromTask(liveTask)) ?? "—"
  const planLabel = formatContractedPlanLabel(liveTask.contractedPlan) ?? "—"
  const amountLabel =
    isWorkOrderTask(liveTask) && liveTask.amountToCollect != null
      ? formatAmountToCollectDisplay(liveTask.amountToCollect)
      : "—"
  const observations = resolveAdminObservations(liveTask)

  return (
    <div className="space-y-4">
      <TaskAdminMetricCard
        icon="📡"
        label="Tecnología"
        value={technologyLabel}
      />
      <TaskAdminMetricCard
        icon="📦"
        label="Plan contratado"
        value={planLabel}
      />
      <TaskAdminMetricCard
        icon="💰"
        label="Importe a cobrar"
        value={amountLabel}
      />

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
