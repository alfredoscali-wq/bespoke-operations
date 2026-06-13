"use client"

import { AlertTriangle } from "lucide-react"

import { useTasks } from "@/components/tareas/tasks-provider"
import type { Task } from "@/lib/types/tasks"
import {
  getIncompleteRequiredItems,
  getRequiredChecklistComplete,
} from "@/lib/tasks/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TaskChecklistTabProps = {
  task: Task
}

export function TaskChecklistTab({ task }: TaskChecklistTabProps) {
  const { toggleChecklistItem } = useTasks()

  const incompleteRequired = getIncompleteRequiredItems(task.checklist)
  const allRequiredComplete = getRequiredChecklistComplete(task.checklist)

  return (
    <div className="space-y-4">
      {!allRequiredComplete && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>Requisitos pendientes</AlertTitle>
          <AlertDescription>
            Esta tarea no puede moverse a &quot;Finalizada&quot; hasta completar:{" "}
            {incompleteRequired.map((item) => item.label).join(", ")}.
          </AlertDescription>
        </Alert>
      )}

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Checklist de campo</CardTitle>
              <CardDescription>
                Marque los entregables conforme se completen en sitio
              </CardDescription>
            </div>
            <span className="text-2xl font-semibold tabular-nums">
              {task.progress}%
            </span>
          </div>
          <Progress value={task.progress} className="mt-2 h-2" />
        </CardHeader>
        <CardContent className="space-y-3">
          {task.checklist.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3"
            >
              <Checkbox
                id={item.id}
                checked={item.completed}
                onCheckedChange={() =>
                  toggleChecklistItem(task.id, item.id)
                }
              />
              <div className="min-w-0 flex-1">
                <Label
                  htmlFor={item.id}
                  className={`cursor-pointer text-sm font-medium ${
                    item.completed
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  }`}
                >
                  {item.label}
                </Label>
                {item.required && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Obligatorio
                  </p>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
