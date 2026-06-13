import type { TaskHistoryEvent } from "@/lib/types/tasks"
import { formatTaskDateTime } from "@/lib/tasks/constants"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

type TaskHistoryTabProps = {
  history: TaskHistoryEvent[]
}

export function TaskHistoryTab({ history }: TaskHistoryTabProps) {
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Historial de actividad</CardTitle>
        <CardDescription>
          Línea de tiempo automática de eventos de la tarea
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[480px] pr-3">
          <div className="space-y-4">
            {sortedHistory.map((event, index) => (
              <div key={event.id} className="relative flex gap-3">
                {index < sortedHistory.length - 1 && (
                  <span className="absolute top-8 left-[15px] h-[calc(100%+4px)] w-px bg-border" />
                )}
                <div className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background">
                  <span className="size-2 rounded-full bg-primary" />
                </div>
                <div className="min-w-0 flex-1 space-y-1 pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {event.action}
                    </p>
                    <span className="text-[11px] text-muted-foreground">
                      {formatTaskDateTime(event.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {event.description}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {event.user}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
