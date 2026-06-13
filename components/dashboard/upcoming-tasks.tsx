import Link from "next/link"
import { CalendarClock, Users } from "lucide-react"

import type { UpcomingTask } from "@/lib/data/dashboard"
import { getUpcomingTaskStatusLabel } from "@/lib/data/dashboard"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

const priorityStyles = {
  alta: "bg-red-50 text-red-700 border-red-100",
  media: "bg-amber-50 text-amber-700 border-amber-100",
  baja: "bg-slate-100 text-slate-600 border-slate-200",
} as const

type UpcomingTasksProps = {
  tasks: UpcomingTask[]
}

export function UpcomingTasks({ tasks }: UpcomingTasksProps) {
  return (
    <Card className="flex h-full flex-col shadow-sm">
      <CardHeader>
        <CardTitle>Próximas Tareas</CardTitle>
        <CardDescription>
          Actividades programadas con fecha límite próxima
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        <ScrollArea className="h-[420px] pr-3">
          <div className="space-y-3">
            {tasks.map((task) => (
              <Link
                key={task.id}
                href={`/tareas/${task.id}`}
                className="block rounded-lg border border-border/80 bg-muted/20 p-3 transition-colors hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-medium leading-snug text-foreground">
                      {task.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {task.project}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 text-[10px] capitalize",
                      priorityStyles[task.priority]
                    )}
                  >
                    {task.priority}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3" />
                    {task.dueDate}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3" />
                    {task.crew}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {getUpcomingTaskStatusLabel(task.status)}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
