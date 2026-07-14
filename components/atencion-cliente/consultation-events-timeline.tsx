"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { ConsultationTimelineCard } from "@/lib/customer-atenciones/consultation-expediente"

type ConsultationEventsTimelineProps = {
  cards: ConsultationTimelineCard[]
  employeeNamesById: Record<string, string>
}

function TransitionRow({
  label,
  previous,
  next,
}: {
  label: string
  previous: string | null
  next: string | null
}) {
  if (!previous && !next) {
    return null
  }

  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-medium text-foreground/80">{label}:</span>{" "}
      {previous ?? "—"} → {next ?? "—"}
    </p>
  )
}

export function ConsultationEventsTimeline({
  cards,
  employeeNamesById,
}: ConsultationEventsTimelineProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de intervenciones</CardTitle>
        <CardDescription>
          Expediente completo de la consulta, del más antiguo al más reciente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {cards.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay intervenciones registradas.
          </p>
        ) : (
          <div className="space-y-4">
            {cards.map((card, index) => {
              const eventDate = new Date(card.createdAt)

              return (
                <div key={card.id} className="relative flex gap-3">
                  {index < cards.length - 1 ? (
                    <span className="absolute top-8 left-[15px] h-[calc(100%+4px)] w-px bg-border" />
                  ) : null}
                  <div className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background">
                    <span className="size-2 rounded-full bg-primary" />
                  </div>
                  <div className="min-w-0 flex-1 rounded-lg border bg-card p-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {card.actionLabel}
                      </p>
                      <span className="text-[11px] text-muted-foreground">
                        {eventDate.toLocaleDateString("es-AR")}{" "}
                        {eventDate.toLocaleTimeString("es-AR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {card.areaLabel}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Usuario:{" "}
                      <span className="font-medium text-foreground">
                        {employeeNamesById[card.employeeId] ?? "—"}
                      </span>
                    </p>
                    <div className="mt-2 space-y-1">
                      <TransitionRow
                        label="Estado"
                        previous={card.previousStatusLabel}
                        next={card.newStatusLabel}
                      />
                      <TransitionRow
                        label="Próximo paso"
                        previous={card.previousNextStepLabel}
                        next={card.newNextStepLabel}
                      />
                    </div>
                    {card.comment ? (
                      <div className="mt-2 rounded-md border bg-muted/30 p-2">
                        <p className="text-[11px] text-muted-foreground">
                          Comentario
                        </p>
                        <p className="whitespace-pre-wrap text-sm text-foreground">
                          {card.comment}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
