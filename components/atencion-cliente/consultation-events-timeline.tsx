"use client"

import { History } from "lucide-react"

import { PanelSectionCard } from "@/components/atencion-cliente/consultation-detail-panel-ui"
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
  presentation?: "page" | "panel"
}

function TimelineFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] leading-none text-muted-foreground">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-[12px] font-medium leading-snug text-foreground">
        {value}
      </p>
    </div>
  )
}

function TimelineBody({
  cards,
  employeeNamesById,
}: {
  cards: ConsultationTimelineCard[]
  employeeNamesById: Record<string, string>
}) {
  if (cards.length === 0) {
    return (
      <p className="py-1.5 text-xs text-muted-foreground">
        Todavía no hay intervenciones registradas.
      </p>
    )
  }

  return (
    <div className="space-y-2.5 py-1">
      {cards.map((card, index) => {
        const eventDate = new Date(card.createdAt)
        const actorName = employeeNamesById[card.employeeId] ?? "Un operador"

        return (
          <div key={card.id} className="relative flex gap-2.5">
            {index < cards.length - 1 ? (
              <span className="absolute top-6 left-[11px] h-[calc(100%+2px)] w-px bg-border" />
            ) : null}
            <div className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border bg-background">
              <span className="size-1.5 rounded-full bg-sky-500" />
            </div>
            <div className="min-w-0 flex-1 rounded-md border bg-background/70 px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground">
                {eventDate.toLocaleDateString("es-AR")}{" "}
                {eventDate.toLocaleTimeString("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="mt-1 text-[13px] leading-snug text-foreground">
                <span className="font-semibold">{actorName}</span>{" "}
                {card.narrativeLead}
              </p>

              {card.facts.length > 0 ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {card.facts.map((fact) => (
                    <TimelineFact
                      key={`${card.id}-${fact.label}`}
                      label={fact.label}
                      value={fact.value}
                    />
                  ))}
                </div>
              ) : null}

              {card.comment && card.commentLabel ? (
                <div className="mt-2 rounded border bg-muted/30 px-2 py-1.5">
                  <TimelineFact label={card.commentLabel} value={card.comment} />
                </div>
              ) : null}

              {card.closingNote ? (
                <p className="mt-2 text-[12px] leading-snug text-muted-foreground">
                  {card.closingNote}
                </p>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function ConsultationEventsTimeline({
  cards,
  employeeNamesById,
  presentation = "page",
}: ConsultationEventsTimelineProps) {
  if (presentation === "panel") {
    return (
      <PanelSectionCard
        title="Expediente / Timeline"
        icon={History}
        tone="blue"
        contentClassName="px-3 py-1.5"
      >
        <TimelineBody cards={cards} employeeNamesById={employeeNamesById} />
      </PanelSectionCard>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Expediente de la consulta</CardTitle>
        <CardDescription>
          Historia completa de la gestión, del más antiguo al más reciente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TimelineBody cards={cards} employeeNamesById={employeeNamesById} />
      </CardContent>
    </Card>
  )
}
