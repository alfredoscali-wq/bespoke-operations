"use client"

import Link from "next/link"
import { CheckCircle2, Circle, ExternalLink } from "lucide-react"

import { getTaskDetail, mockTasks } from "@/lib/data/tasks"
import {
  getIncompleteRequiredItems,
  getRequiredChecklistComplete,
} from "@/lib/tasks/utils"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type EvidenceChecklistPanelProps = {
  taskId: string
  taskCode: string
  taskTitle: string
  evidenceCount: number
}

export function EvidenceChecklistPanel({
  taskId,
  taskCode,
  taskTitle,
  evidenceCount,
}: EvidenceChecklistPanelProps) {
  const task = mockTasks.find((item) => item.id === taskId)

  if (!task) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Checklist de tarea</CardTitle>
          <CardDescription>
            No se encontró información de checklist para esta tarea.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const detail = getTaskDetail(task)
  const allRequiredComplete = getRequiredChecklistComplete(task.checklist)
  const incompleteRequired = getIncompleteRequiredItems(task.checklist)
  const completedCount = task.checklist.filter((item) => item.completed).length

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">Checklist de tarea</CardTitle>
            <CardDescription className="line-clamp-2">
              {taskCode} · {taskTitle}
            </CardDescription>
          </div>
          <Link
            href={`/tareas/${taskId}`}
            className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
          >
            Ver tarea
            <ExternalLink className="size-3" />
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Badge variant="outline" className="font-normal">
            {evidenceCount}{" "}
            {evidenceCount === 1 ? "evidencia" : "evidencias"} en la tarea
          </Badge>
          <Badge
            variant="outline"
            className={
              allRequiredComplete
                ? "border-emerald-100 bg-emerald-50 font-normal text-emerald-700"
                : "border-amber-100 bg-amber-50 font-normal text-amber-700"
            }
          >
            {allRequiredComplete
              ? "Requisitos completos"
              : `${incompleteRequired.length} requisito(s) pendiente(s)`}
          </Badge>
        </div>

        <div className="space-y-1.5 pt-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {completedCount} de {task.checklist.length} ítems
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {task.progress}%
            </span>
          </div>
          <Progress value={task.progress} className="h-1.5" />
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {task.checklist.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-2.5 rounded-lg border bg-muted/20 px-3 py-2.5"
          >
            {item.completed ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
            ) : (
              <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
            )}
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm leading-snug ${
                  item.completed
                    ? "text-muted-foreground line-through"
                    : "text-foreground"
                }`}
              >
                {item.label}
              </p>
              {item.required && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Requerido
                </p>
              )}
            </div>
          </div>
        ))}

        {detail.evidence.length > 0 && (
          <p className="pt-1 text-[11px] text-muted-foreground">
            Última evidencia registrada en tarea:{" "}
            {detail.evidence[0]?.title ?? "—"}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
