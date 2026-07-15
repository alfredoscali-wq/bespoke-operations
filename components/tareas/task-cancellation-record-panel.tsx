"use client"

import { useEffect, useMemo, useState } from "react"

import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { listTaskOperationalEvents } from "@/lib/supabase/operational-control.browser"
import {
  formatOperationalEventOccurredParts,
  readOperationalEventActor,
} from "@/lib/tasks/operational-event-actor"
import { formatTaskDateTime } from "@/lib/tasks/constants"
import type { TaskOperationalEvent } from "@/lib/types/operational-control"
import type { Task } from "@/lib/types/tasks"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type TaskCancellationRecordPanelProps = {
  task: Task
  relatedIncidentLabel?: string | null
}

function readPayloadString(
  payload: Record<string, unknown>,
  key: string
): string {
  const value = payload[key]
  return typeof value === "string" ? value.trim() : ""
}

function findCancelledEvent(
  events: TaskOperationalEvent[]
): TaskOperationalEvent | null {
  const cancelled = events
    .filter((event) => event.eventType === "cancelled")
    .sort(
      (left, right) =>
        new Date(right.occurredAt).getTime() -
        new Date(left.occurredAt).getTime()
    )

  return cancelled[0] ?? null
}

export function TaskCancellationRecordPanel({
  task,
  relatedIncidentLabel,
}: TaskCancellationRecordPanelProps) {
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [cancelledEvent, setCancelledEvent] =
    useState<TaskOperationalEvent | null>(null)
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false)

  useEffect(() => {
    if (task.status !== "cancelada" || !isAuthReady || !companyId) {
      return
    }

    let cancelled = false

    async function load() {
      const result = await listTaskOperationalEvents(companyId, task.id)
      if (cancelled) return

      if (!result.error && result.data) {
        setCancelledEvent(findCancelledEvent(result.data))
      } else {
        setCancelledEvent(null)
      }
      setHasLoadedHistory(true)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady, task.id, task.status])

  const rows = useMemo(() => {
    if (task.status !== "cancelada") {
      return []
    }

    if (cancelledEvent) {
      const actor = readOperationalEventActor(cancelledEvent)
      const payload = cancelledEvent.payload ?? {}
      const motivo =
        readPayloadString(payload, "reasonLabel") ||
        readPayloadString(payload, "reasonCode") ||
        "—"
      const observations =
        readPayloadString(payload, "notes") ||
        cancelledEvent.observations.trim() ||
        "—"
      const relatedIncidentId = readPayloadString(payload, "relatedIncidentId")
      const relatedIncident =
        relatedIncidentId
          ? relatedIncidentLabel?.trim() ||
            relatedIncidentId.slice(0, 8)
          : "—"
      const occurred = formatOperationalEventOccurredParts(
        cancelledEvent.occurredAt || cancelledEvent.createdAt
      )
      const cancellationDate = [occurred.date, occurred.time]
        .filter(Boolean)
        .join(" · ")

      return [
        { label: "Estado", value: "Cancelada" },
        { label: "Cancelada por", value: actor.fullName || "—" },
        { label: "Área", value: actor.area || "—" },
        { label: "Rol", value: actor.role || "—" },
        {
          label: "Fecha de cancelación",
          value: cancellationDate || "—",
        },
        { label: "Motivo", value: motivo },
        { label: "Observaciones", value: observations },
        {
          label: "Incidencia relacionada",
          value: relatedIncident,
        },
      ]
    }

    // Still loading history — avoid flashing the legacy supervisor block.
    if (!hasLoadedHistory) {
      return [{ label: "Estado", value: "Cancelada" }]
    }

    // Legacy OT without durable cancelled event — keep previous fallback.
    return [
      { label: "Estado", value: "Cancelada" },
      {
        label: "Motivo",
        value: task.cancellationReason?.trim() || "—",
      },
      {
        label: "Observaciones",
        value: task.cancellationObservation?.trim() || "—",
      },
      { label: "Supervisor", value: task.supervisor?.trim() || "—" },
      {
        label: "Fecha de cancelación",
        value: task.closedAt
          ? formatTaskDateTime(task.closedAt)
          : task.completedAt
            ? formatTaskDateTime(task.completedAt)
            : task.createdAt
              ? formatTaskDateTime(task.createdAt)
              : "—",
      },
      {
        label: "Incidencia relacionada",
        value: relatedIncidentLabel?.trim() || "—",
      },
    ]
  }, [
    cancelledEvent,
    hasLoadedHistory,
    relatedIncidentLabel,
    task.cancellationObservation,
    task.cancellationReason,
    task.closedAt,
    task.completedAt,
    task.createdAt,
    task.status,
    task.supervisor,
  ])

  if (task.status !== "cancelada") {
    return null
  }

  return (
    <Card className="border-destructive/30 bg-destructive/5 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Registro de cancelación</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label}>
            <p className="text-xs text-muted-foreground">{row.label}</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {row.value}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
