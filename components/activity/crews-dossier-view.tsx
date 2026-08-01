"use client"

/**
 * Cuadrillas dossier presentation — Sprint 27 adaptive timeline.
 * Single-day keeps the existing Timeline. Multi-day groups by jornada.
 */

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MapPinned,
  TriangleAlert,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  buildCrewsDayJourneys,
  formatCrewsWorkedDuration,
  isCrewsSingleDayPeriod,
  resolveCrewsDossierTitle,
  resolveCrewsPeriodIncidents,
  resolveCrewsSidePeriodSummary,
  type CrewsPeriodMeta,
} from "@/lib/analysis/crews/dossier-presentation"
import type {
  CrewsDossier,
  CrewsWorkOrderRow,
} from "@/lib/analysis/crews/types"
import type {
  PlanningTimelineCard,
  PlanningTimelineWorkOrderOutcome,
} from "@/lib/analysis/planning-timeline/types"
import { FILTER_SELECT_TRIGGER_CLASS } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

function outcomeIcon(outcome: PlanningTimelineWorkOrderOutcome) {
  if (outcome === "finished") {
    return <Check className="size-3.5 text-emerald-700" aria-hidden />
  }
  if (outcome === "rescheduled" || outcome === "incident") {
    return <TriangleAlert className="size-3.5 text-amber-700" aria-hidden />
  }
  if (outcome === "cancelled") {
    return <X className="size-3.5 text-red-700" aria-hidden />
  }
  return null
}

function outcomeLabel(outcome: PlanningTimelineWorkOrderOutcome): string {
  if (outcome === "finished") return "Finalizada"
  if (outcome === "rescheduled") return "Reprogramada"
  if (outcome === "cancelled") return "Cancelada"
  if (outcome === "incident") return "Con incidencia"
  return "Pendiente"
}

function formatTime(value: string | null | undefined): string {
  const trimmed = value?.trim()
  if (!trimmed) return "—"
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/)
  if (match) return `${match[1].padStart(2, "0")}:${match[2]}`
  return trimmed
}

/** Full-height cards — used only for Hoy / Ayer. */
function TimelineCardInline({
  card,
  planningHref,
}: {
  card: PlanningTimelineCard
  planningHref: (taskId: string) => string
}) {
  if (card.kind === "day-start") {
    return (
      <article className="rounded-2xl border bg-card px-5 py-5 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Inicio de jornada
        </p>
        <p className="mt-2 text-xl font-semibold tabular-nums">{card.timeLabel}</p>
        <p className="mt-2 font-medium">{card.crewName}</p>
        {card.memberNames.length > 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {card.memberNames.join(" · ")}
          </p>
        ) : null}
        {card.vehicleLabel ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Vehículo: {card.vehicleLabel}
          </p>
        ) : null}
      </article>
    )
  }

  if (card.kind === "travel") {
    return (
      <article className="rounded-2xl border border-dashed bg-muted/20 px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Traslado
        </p>
        <p className="mt-2 text-sm">{card.fromLabel}</p>
        <p className="text-muted-foreground">↓</p>
        <p className="text-sm">{card.toLabel}</p>
        <p className="mt-2 text-sm text-muted-foreground">{card.minutes} min</p>
      </article>
    )
  }

  if (card.kind === "work-order") {
    return (
      <article className="rounded-2xl border bg-card px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Orden de trabajo
            </p>
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
              {card.timeLabel}
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-medium">
            {outcomeIcon(card.outcome)}
            {outcomeLabel(card.outcome)}
          </span>
        </div>
        <p className="mt-3 font-semibold">{card.customerName}</p>
        <p className="text-sm text-muted-foreground">{card.workType}</p>
        <p className="mt-2 text-sm">Resultado: {card.result}</p>
        {card.durationMinutes > 0 ? (
          <p className="text-sm text-muted-foreground">
            Tiempo total: {card.durationMinutes} min
          </p>
        ) : null}
        <Button asChild size="sm" className="mt-4">
          <Link href={planningHref(card.taskId)}>
            Ver OT
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </article>
    )
  }

  if (card.kind === "incident") {
    return (
      <article className="rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-amber-900/70">
          Incidente
        </p>
        <p className="mt-2 font-medium text-amber-950">{card.title}</p>
        {card.detail ? (
          <p className="mt-1 text-sm text-amber-950/80">{card.detail}</p>
        ) : null}
      </article>
    )
  }

  return (
    <article className="rounded-2xl border bg-card px-5 py-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Fin de jornada
      </p>
      <p className="mt-3 text-sm leading-relaxed">{card.summary}</p>
    </article>
  )
}

/** Compact ~50% height cards for multi-day journeys. */
function CompactWorkOrderCard({
  row,
  planningHref,
}: {
  row: CrewsWorkOrderRow
  planningHref: (taskId: string) => string
}) {
  const isIncident = row.status === "incidencia"
  const route =
    row.travelFromLabel && row.customerName
      ? `${row.travelFromLabel} → ${row.customerName}`
      : null

  return (
    <article
      className={cn(
        "rounded-xl border px-3 py-2.5 shadow-sm",
        isIncident
          ? "border-amber-300 bg-amber-50/70"
          : "border-foreground/15 bg-card"
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-xs font-semibold tabular-nums text-foreground">
              {formatTime(row.scheduledTime)}
            </span>
            <span className="truncate text-sm font-semibold">
              {row.customerName}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {row.result}
            {row.durationMinutes > 0 ? ` · ${row.durationMinutes} min` : ""}
            {` · ${row.serviceType}`}
          </p>
          {route ? (
            <p className="text-[11px] text-muted-foreground/90">{route}</p>
          ) : null}
        </div>
        <Button asChild size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs">
          <Link href={planningHref(row.taskId)}>Abrir OT</Link>
        </Button>
      </div>
    </article>
  )
}

function CompactTravelHint({
  fromLabel,
  toLabel,
  minutes,
}: {
  fromLabel: string
  toLabel: string
  minutes: number | null
}) {
  return (
    <div className="flex items-center gap-2 px-1 py-1 text-[11px] text-muted-foreground">
      <span className="truncate">
        {fromLabel} → {toLabel}
      </span>
      {minutes != null && minutes > 0 ? (
        <span className="shrink-0 tabular-nums">{minutes} min</span>
      ) : null}
    </div>
  )
}

function DayJourneyBlock({
  journey,
  planningHref,
}: {
  journey: ReturnType<typeof buildCrewsDayJourneys>[number]
  planningHref: (taskId: string) => string
}) {
  const { summary } = journey

  return (
    <section className="space-y-3 border-b border-border/70 pb-6 last:border-b-0 last:pb-0">
      <header className="rounded-xl border bg-muted/30 px-4 py-3">
        <h4 className="text-base font-semibold tracking-tight">
          {journey.heading}
        </h4>
        <div className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
          <p>
            <span className="tabular-nums font-medium text-foreground">
              {summary.assignedOt}
            </span>{" "}
            OT asignadas
          </p>
          <p>
            <span className="tabular-nums font-medium text-foreground">
              {summary.finishedOt}
            </span>{" "}
            Finalizadas
          </p>
          {summary.rescheduledOt > 0 ? (
            <p>
              <span className="tabular-nums font-medium text-foreground">
                {summary.rescheduledOt}
              </span>{" "}
              Reprogramada{summary.rescheduledOt === 1 ? "" : "s"}
            </p>
          ) : null}
          <p>
            <span className="tabular-nums font-medium text-foreground">
              {summary.compliance}%
            </span>{" "}
            Cumplimiento
          </p>
          <p>
            <span className="tabular-nums font-medium text-foreground">
              {formatCrewsWorkedDuration(summary.workedMinutes)}
            </span>{" "}
            trabajadas
          </p>
          <p>
            Tiempo promedio{" "}
            <span className="tabular-nums font-medium text-foreground">
              {summary.avgMinutesPerOt} min
            </span>
          </p>
        </div>
      </header>

      <div className="space-y-1.5">
        {journey.workOrders.length === 0 ? (
          <p className="px-1 text-sm text-muted-foreground">
            Sin intervenciones este día.
          </p>
        ) : (
          journey.workOrders.map((row) => (
            <div key={row.taskId} className="space-y-1">
              {row.travelFromLabel ? (
                <CompactTravelHint
                  fromLabel={row.travelFromLabel}
                  toLabel={row.customerName}
                  minutes={row.travelFromPreviousMinutes}
                />
              ) : null}
              <CompactWorkOrderCard row={row} planningHref={planningHref} />
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function TrendBars({ dossier }: { dossier: CrewsDossier }) {
  const max = Math.max(
    1,
    ...dossier.trends.map((bucket) => bucket.finishedOt)
  )

  return (
    <div className="space-y-4">
      {dossier.trends.map((bucket) => (
        <div key={bucket.id}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{bucket.label}</span>
            <span className="tabular-nums text-muted-foreground">
              {bucket.finishedOt}/{bucket.assignedOt} OT · {bucket.productivity}%
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground/70"
              style={{
                width: `${Math.round((bucket.finishedOt / max) * 100)}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function SidePeriodSummary({
  period,
  dossier,
}: {
  period: CrewsPeriodMeta
  dossier: CrewsDossier
}) {
  const side = resolveCrewsSidePeriodSummary(
    period,
    dossier.productivity,
    resolveCrewsPeriodIncidents(dossier)
  )

  const rows: Array<[string, string | number]> = [
    ["Período", side.periodLabel],
    ["OT", side.assignedOt],
    ["Cumplimiento", `${side.compliance}%`],
    ["Tiempo promedio", `${side.avgMinutesPerOt} min`],
    ["Horas trabajadas", side.hoursWorkedLabel],
    ["Incidencias", side.incidents],
  ]

  return (
    <aside className="space-y-3 lg:sticky lg:top-4">
      <h3 className="text-sm font-medium text-muted-foreground">
        Resumen del período
      </h3>
      <article className="rounded-2xl border bg-card p-4 shadow-sm">
        <dl className="space-y-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-sm font-semibold tabular-nums text-right">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </article>

      <h3 className="pt-2 text-sm font-medium text-muted-foreground">
        Productividad
      </h3>
      <article className="rounded-2xl border bg-card p-4 shadow-sm">
        <dl className="space-y-2.5 text-sm">
          {(
            [
              ["Finalizadas", dossier.productivity.finishedOt],
              ["Pendientes", dossier.productivity.pendingOt],
              ["Canceladas", dossier.productivity.cancelledOt],
              ["Reprogramadas", dossier.productivity.rescheduledOt],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-3"
            >
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </article>
    </aside>
  )
}

function crewProductionStatusLabelSafe(status: string): string {
  const labels: Record<string, string> = {
    asignada: "Programada",
    "en-curso": "En curso",
    finalizada: "Finalizada",
    cerrada: "Cerrada",
    cancelada: "Cancelada",
    incidencia: "Incidencia",
    programada: "Programada",
  }
  return labels[status] ?? status
}

export function CrewsDossierView({
  dossier,
  period,
  onBack,
  planningHref,
}: {
  dossier: CrewsDossier
  period: CrewsPeriodMeta
  onBack: () => void
  planningHref: (taskId: string) => string
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const singleDay = isCrewsSingleDayPeriod(period)
  const heading = resolveCrewsDossierTitle(period)

  const journeys = useMemo(
    () => (singleDay ? [] : buildCrewsDayJourneys(dossier.workOrders)),
    [dossier.workOrders, singleDay]
  )

  const workOrders = useMemo(() => {
    if (statusFilter === "all") return dossier.workOrders
    return dossier.workOrders.filter((row) => row.status === statusFilter)
  }, [dossier.workOrders, statusFilter])

  const statuses = useMemo(() => {
    const set = new Set(dossier.workOrders.map((row) => row.status))
    return [...set]
  }, [dossier.workOrders])

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4" />
            Ranking
          </Button>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            {heading.title}
          </h2>
          {heading.subtitle ? (
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">
              {heading.subtitle}
            </p>
          ) : null}
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {dossier.crewName}
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-8">
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              Resumen ejecutivo
            </h3>
            <article className="rounded-2xl border bg-card p-5 text-sm leading-relaxed shadow-sm whitespace-pre-line">
              {dossier.narrative}
            </article>
          </section>

          {singleDay ? (
            <section className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">
                Timeline Operativo
              </h3>
              <div className="space-y-6">
                {dossier.timeline.cards.map((card) => (
                  <TimelineCardInline
                    key={card.id}
                    card={card}
                    planningHref={planningHref}
                  />
                ))}
              </div>
            </section>
          ) : (
            <section className="space-y-6">
              <h3 className="text-sm font-medium text-muted-foreground">
                Jornadas del período
              </h3>
              {journeys.length === 0 ? (
                <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground shadow-sm">
                  Sin jornadas con órdenes en el período seleccionado.
                </p>
              ) : (
                journeys.map((journey) => (
                  <DayJourneyBlock
                    key={journey.date}
                    journey={journey}
                    planningHref={planningHref}
                  />
                ))
              )}
            </section>
          )}

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h3 className="text-sm font-medium text-muted-foreground">
                Órdenes de Trabajo
              </h3>
              <div className="w-[12rem]">
                <Label className="sr-only">Estado</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className={FILTER_SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {crewProductionStatusLabelSafe(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              {workOrders.length === 0 ? (
                <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground shadow-sm">
                  Sin órdenes en el período.
                </p>
              ) : (
                workOrders.map((row) => (
                  <article
                    key={row.taskId}
                    className="rounded-xl border bg-card px-4 py-3 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{row.customerName}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {row.dueDate} · {row.serviceType} · {row.zone}
                        </p>
                        <p className="mt-1 text-sm">
                          {row.statusLabel} · {row.result}
                          {row.durationMinutes > 0
                            ? ` · ${row.durationMinutes} min`
                            : ""}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="h-7">
                        <Link href={planningHref(row.taskId)}>Abrir OT</Link>
                      </Button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              Tendencias
            </h3>
            <article className="rounded-2xl border bg-card p-5 shadow-sm">
              <TrendBars dossier={dossier} />
            </article>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              {dossier.gpsCoverage.title}
            </h3>
            <article className="rounded-2xl border border-dashed bg-muted/20 px-5 py-8 text-center">
              <MapPinned className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                {dossier.gpsCoverage.message}
              </p>
            </article>
          </section>
        </div>

        <SidePeriodSummary period={period} dossier={dossier} />
      </div>
    </div>
  )
}
