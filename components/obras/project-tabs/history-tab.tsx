import type { ProjectHistoryEvent } from "@/lib/types/projects"
import { getHistoryTitleForEvent } from "@/lib/projects/utils"

type ProjectHistoryTabProps = {
  history: ProjectHistoryEvent[]
}

function formatHistoryDate(date: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

export function ProjectHistoryTab({ history }: ProjectHistoryTabProps) {
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  if (sortedHistory.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/15 px-4 py-10 text-center">
        <p className="text-sm font-medium text-foreground">
          Sin eventos registrados
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="max-h-[420px] space-y-0 overflow-y-auto p-4">
        {sortedHistory.map((event, index) => (
          <div
            key={event.id}
            className="relative flex gap-3 py-3 first:pt-0 last:pb-0"
          >
            {index < sortedHistory.length - 1 ? (
              <span className="absolute top-7 left-[7px] h-[calc(100%-4px)] w-px bg-border" />
            ) : null}
            <div className="relative z-10 mt-1 size-3.5 shrink-0 rounded-full border-2 border-primary bg-background" />
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <p className="text-sm font-medium text-foreground">
                  {event.title || getHistoryTitleForEvent(event.eventType)}
                </p>
                <span className="text-[11px] text-muted-foreground">
                  {formatHistoryDate(event.timestamp)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{event.description}</p>
              <p className="text-[11px] text-muted-foreground">{event.user}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
