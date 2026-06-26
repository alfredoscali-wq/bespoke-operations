import Link from "next/link"

import type { Task } from "@/lib/types/tasks"
import { formatScheduledTimeDisplay } from "@/lib/tasks/scheduling"
import { resolveTaskOperationalTitle } from "@/lib/tasks/work-order"
import { Button } from "@/components/ui/button"

type OperarioTaskCardProps = {
  task: Task
}

export function OperarioTaskCard({ task }: OperarioTaskCardProps) {
  const scheduledTime = formatScheduledTimeDisplay(task.scheduledTime)
  const customerName = task.customerName?.trim() || task.projectName?.trim() || "—"
  const workType = resolveTaskOperationalTitle(task)
  const address = task.serviceAddress?.trim() || "—"

  return (
    <article className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">🕒 Hora programada</dt>
          <dd className="font-medium text-foreground">{scheduledTime ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">👤 Cliente</dt>
          <dd className="font-medium text-foreground">{customerName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">🔧 Tipo de trabajo</dt>
          <dd className="font-medium text-foreground">{workType}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">📍 Dirección</dt>
          <dd className="font-medium text-foreground">{address}</dd>
        </div>
      </dl>

      <Button
        asChild
        className="mt-4 h-11 w-full rounded-xl text-sm font-semibold"
      >
        <Link href={`/operario/tarea/${task.id}`}>Ver OT</Link>
      </Button>
    </article>
  )
}
