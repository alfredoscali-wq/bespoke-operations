"use client"

import { formatTaskDateTime } from "@/lib/tasks/constants"
import { formatScheduledTimeForInput } from "@/lib/tasks/scheduling"
import { readPlanningReturnInfo } from "@/lib/tasks/planning-return"
import type { Task } from "@/lib/types/tasks"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TaskPlanningReturnRecordPanelProps = {
  task: Task
}

export function TaskPlanningReturnRecordPanel({
  task,
}: TaskPlanningReturnRecordPanelProps) {
  const returnInfo = readPlanningReturnInfo(task)

  if (!returnInfo) {
    return null
  }

  const previousSchedule = [
    returnInfo.previousDueDate
      ? formatTaskDateTime(returnInfo.previousDueDate)
      : null,
    returnInfo.previousScheduledTime
      ? formatScheduledTimeForInput(returnInfo.previousScheduledTime)
      : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <Card className="border-amber-200 bg-amber-50/60 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-amber-950">
          Devuelta por Planificación
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-amber-900/70">
            Motivo
          </p>
          <p className="mt-1 whitespace-pre-wrap text-amber-950">
            {returnInfo.reason}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-amber-900/70">
              Devuelta por
            </p>
            <p className="mt-1 text-amber-950">{returnInfo.returnedBy}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-amber-900/70">
              Fecha y hora
            </p>
            <p className="mt-1 text-amber-950">
              {formatTaskDateTime(returnInfo.returnedAt)}
            </p>
          </div>
        </div>

        {returnInfo.previousCrewName || previousSchedule ? (
          <div className="rounded-md border border-amber-200/80 bg-white/70 px-3 py-2 text-amber-950">
            {returnInfo.previousCrewName ? (
              <p>
                <span className="font-medium">Cuadrilla anterior:</span>{" "}
                {returnInfo.previousCrewName}
              </p>
            ) : null}
            {previousSchedule ? (
              <p>
                <span className="font-medium">Programación anterior:</span>{" "}
                {previousSchedule}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
