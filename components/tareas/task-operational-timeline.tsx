"use client"

import { useEffect, useMemo, useState } from "react"

import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { listTaskOperationalEvents } from "@/lib/supabase/operational-control.browser"
import {
  formatOperationalEventActorMeta,
  formatOperationalEventOccurredParts,
  readOperationalEventActor,
} from "@/lib/tasks/operational-event-actor"
import type { TaskOperationalEvent } from "@/lib/types/operational-control"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

type TimelineItem = {
  id: string
  action: string
  description: string
  observations: string
  fullName: string
  meta: string
  date: string
  time: string
  timestamp: string
}

type TaskOperationalTimelineProps = {
  taskId: string
  /** Bump to refetch durable events after mutations. */
  refreshKey?: number | string
}

/**
 * Durable Historial Operativo — reads only from task_operational_events.
 * Does not mix session/local history (those use incomplete actor labels).
 */
export function TaskOperationalTimeline({
  taskId,
  refreshKey = 0,
}: TaskOperationalTimelineProps) {
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [events, setEvents] = useState<TaskOperationalEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isAuthReady || !companyId || !taskId) {
      return
    }

    let cancelled = false

    async function load() {
      setIsLoading(true)
      const result = await listTaskOperationalEvents(companyId, taskId)
      if (cancelled) return

      if (result.error) {
        const message = result.error.message
        const missingTable =
          /task_operational_events/i.test(message) ||
          /Could not find the table/i.test(message) ||
          /schema cache/i.test(message)

        setError(
          missingTable
            ? "No se encontró la tabla public.task_operational_events. Aplique la migración 20261016000100 y recargue el schema cache de PostgREST."
            : message
        )
        setEvents([])
        setIsLoading(false)
        return
      }

      setError(null)
      setEvents(result.data ?? [])
      setIsLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady, taskId, refreshKey])

  const items = useMemo(() => {
    return events
      .map((event): TimelineItem => {
        const actor = readOperationalEventActor(event)
        const occurred = formatOperationalEventOccurredParts(event.occurredAt)
        return {
          id: event.id,
          action: event.title,
          description: event.description,
          observations: event.observations,
          fullName: actor.fullName,
          meta: formatOperationalEventActorMeta(actor),
          date: occurred.date,
          time: occurred.time,
          timestamp: event.occurredAt,
        }
      })
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
  }, [events])

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Historial operativo</CardTitle>
        <CardDescription>
          Línea de tiempo durable de eventos de la orden. Los eventos no se
          eliminan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {!error && isLoading && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Cargando historial…</p>
        ) : null}
        {!error && !isLoading && items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay eventos registrados para esta OT.
          </p>
        ) : null}
        {items.length > 0 ? (
          <ScrollArea className="h-[420px] pr-3">
            <div className="space-y-4">
              {items.map((event, index) => (
                <div key={event.id} className="relative flex gap-3">
                  {index < items.length - 1 ? (
                    <span className="absolute top-8 left-[15px] h-[calc(100%+4px)] w-px bg-border" />
                  ) : null}
                  <div className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-background">
                    <span className="size-2 rounded-full bg-primary" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5 pb-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {event.fullName}
                      </p>
                      {event.meta ? (
                        <p className="text-xs text-muted-foreground">
                          {event.meta}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-sm text-foreground">{event.action}</p>
                    {event.description ? (
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {event.description}
                      </p>
                    ) : null}
                    {event.observations ? (
                      <p className="text-xs text-muted-foreground">
                        Observaciones: {event.observations}
                      </p>
                    ) : null}
                    <p className="text-[11px] text-muted-foreground">
                      {event.date}
                      {event.time ? ` · ${event.time}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : null}
      </CardContent>
    </Card>
  )
}
