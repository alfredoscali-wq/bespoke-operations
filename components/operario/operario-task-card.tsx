import Link from "next/link"

import type { Task } from "@/lib/types/tasks"
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_STYLES,
  formatTaskDate,
} from "@/lib/tasks/constants"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type OperarioTaskCardProps = {
  task: Task
}

export function OperarioTaskCard({ task }: OperarioTaskCardProps) {
  return (
    <article className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
      <div className="flex items-start justify-end gap-3">
        <Badge
          variant="outline"
          className={cn("text-[10px]", TASK_PRIORITY_STYLES[task.priority])}
        >
          {TASK_PRIORITY_LABELS[task.priority]}
        </Badge>
      </div>

      <h3 className="mt-2 text-base leading-snug font-semibold text-foreground">
        {task.title}
      </h3>

      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Prioridad:</dt>
          <dd>{TASK_PRIORITY_LABELS[task.priority]}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Vence:</dt>
          <dd>{formatTaskDate(task.dueDate)}</dd>
        </div>
      </dl>

      <Button
        asChild
        className="mt-4 h-11 w-full rounded-xl text-sm font-semibold"
      >
        <Link href={`/operario/tarea/${task.id}`}>Ver tarea</Link>
      </Button>
    </article>
  )
}
