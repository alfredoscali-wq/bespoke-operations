import { formatMaterialDateTime } from "@/lib/materials/constants"
import type { MaterialHistoryEvent } from "@/lib/types/materials"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type MaterialHistoryTabProps = {
  history: MaterialHistoryEvent[]
}

export function MaterialHistoryTab({ history }: MaterialHistoryTabProps) {
  if (history.length === 0) {
    return (
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Historial</CardTitle>
          <CardDescription>
            No hay eventos registrados para este material.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Historial del material</CardTitle>
        <CardDescription>
          Bitácora de cambios, alertas y operaciones
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-0">
          {history.map((event, index) => (
            <div key={event.id} className="relative flex gap-4 pb-8 last:pb-0">
              {index < history.length - 1 && (
                <span className="absolute top-3 left-[11px] h-full w-px bg-border" />
              )}
              <span className="relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full border-2 border-primary bg-background" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{event.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMaterialDateTime(event.timestamp)}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {event.description}
                </p>
                <p className="text-xs text-muted-foreground">{event.user}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
