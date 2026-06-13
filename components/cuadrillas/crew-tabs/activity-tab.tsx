import {
  CREW_ACTIVITY_LABELS,
  formatCrewDateTime,
} from "@/lib/crews/constants"
import type { CrewActivityEvent } from "@/lib/types/crews"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

type CrewActivityTabProps = {
  activity: CrewActivityEvent[]
}

export function CrewActivityTab({ activity }: CrewActivityTabProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Actividad reciente</CardTitle>
        <CardDescription>
          Línea de tiempo de asignaciones, trabajo en campo, evidencias y cierres
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sin actividad registrada
          </p>
        ) : (
          <ScrollArea className="h-[480px] pr-3">
            <div className="space-y-4">
              {activity.map((event, index) => (
                <div key={event.id} className="relative flex gap-3">
                  {index < activity.length - 1 && (
                    <span className="absolute top-8 left-[15px] h-[calc(100%+4px)] w-px bg-border" />
                  )}
                  <div className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background">
                    <span className="size-2 rounded-full bg-primary" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1 pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {CREW_ACTIVITY_LABELS[event.type]}
                      </p>
                      <span className="text-[11px] text-muted-foreground">
                        {formatCrewDateTime(event.timestamp)}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {event.description}
                    </p>
                    {(event.taskCode || event.projectCode) && (
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {[event.projectCode, event.taskCode]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
