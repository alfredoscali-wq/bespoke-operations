"use client"

import {
  formatActivityTimelineDate,
  formatActivityTimelineTime,
} from "@/lib/activity/activity-timeline-groups"
import type { ExecutiveBrief } from "@/lib/executive"
import { getIndicatorDefinition } from "@/lib/indicators"
import { cn } from "@/lib/utils"

function formatActiveTime(ms: number): string {
  if (ms <= 0) return "—"
  const totalMinutes = Math.floor(ms / 60_000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${String(minutes).padStart(2, "0")}m`
}

function formatStamp(value: string | null): string {
  if (!value) return "—"
  return `${formatActivityTimelineDate(value)} ${formatActivityTimelineTime(value)}`
}

export function ExecutiveBriefView({
  brief,
  isLoading,
  className,
  /** When false, hides Actividad Relevante (entity views may rely on timeline). */
  showRelevantActivity = true,
  /** When false, hides Estado Operativo (less useful on small scopes). */
  showOperationalState = true,
}: {
  brief: ExecutiveBrief | null
  isLoading?: boolean
  className?: string
  showRelevantActivity?: boolean
  showOperationalState?: boolean
}) {
  if (isLoading || !brief) {
    return (
      <div className={cn("space-y-6", className)}>
        <p className="text-sm text-muted-foreground">Cargando resumen…</p>
      </div>
    )
  }

  const detailEntries = Object.entries(brief.snapshot.values)
    .map(([id, value]) => {
      const definition = getIndicatorDefinition(id)
      if (!definition || definition.unit === "timestamp_iso") return null
      if (typeof value !== "number" || value === 0) return null
      return { id, label: definition.name, value }
    })
    .filter((item): item is { id: string; label: string; value: number } =>
      Boolean(item)
    )
    .sort((a, b) => a.label.localeCompare(b.label, "es"))

  return (
    <div className={cn("space-y-8", className)}>
      {/* A / Resumen Ejecutivo */}
      <section className="space-y-3">
        <header>
          <h3 className="text-sm font-semibold tracking-tight">
            Resumen ejecutivo
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{brief.narrative}</p>
        </header>

        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {brief.generalState.map((item) => (
            <div key={item.id} className="min-w-[7rem]">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="tabular-nums text-base font-semibold">{item.value}</p>
            </div>
          ))}
          <div className="min-w-[7rem]">
            <p className="text-xs text-muted-foreground">Inicio</p>
            <p className="text-sm font-medium">{formatStamp(brief.firstEventAt)}</p>
          </div>
          <div className="min-w-[7rem]">
            <p className="text-xs text-muted-foreground">Cierre</p>
            <p className="text-sm font-medium">{formatStamp(brief.lastEventAt)}</p>
          </div>
          <div className="min-w-[7rem]">
            <p className="text-xs text-muted-foreground">Tiempo activo</p>
            <p className="text-sm font-medium tabular-nums">
              {formatActiveTime(brief.activeTimeMs)}
            </p>
          </div>
        </div>
      </section>

      {/* B / Producción */}
      <section className="space-y-4">
        <header>
          <h3 className="text-sm font-semibold tracking-tight">Producción</h3>
        </header>
        {brief.production.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin producción registrada en esta fecha.
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            {brief.production.map((block) => (
              <div key={block.id} className="space-y-2">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {block.title}
                </h4>
                <ul className="space-y-1.5">
                  {block.metrics.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-baseline justify-between gap-3 text-sm"
                    >
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-semibold tabular-nums">
                        {item.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* C / Estado operativo */}
      {showOperationalState ? (
        <section className="space-y-3">
          <header>
            <h3 className="text-sm font-semibold tracking-tight">
              Estado operativo
            </h3>
          </header>
          {brief.operationalAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin novedades críticas.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {brief.operationalAlerts.map((alert) => (
                <li
                  key={alert.id}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span>{alert.label}</span>
                  <span className="font-semibold tabular-nums">{alert.value}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* D / Actividad relevante */}
      {showRelevantActivity ? (
        <section className="space-y-3">
          <header>
            <h3 className="text-sm font-semibold tracking-tight">
              Actividad relevante
            </h3>
            <p className="text-xs text-muted-foreground">
              Solo hechos importantes · máximo 10
            </p>
          </header>
          {brief.relevantActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin actividad relevante en esta fecha.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {brief.relevantActivity.map((item) => (
                <li key={item.id} className="px-3 py-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatActivityTimelineTime(item.createdAt)}
                    </p>
                  </div>
                  {item.description ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* Detalle — indicator traceability */}
      <section className="space-y-3">
        <header>
          <h3 className="text-sm font-semibold tracking-tight">Detalle</h3>
          <p className="text-xs text-muted-foreground">
            Indicadores del Motor · trazabilidad de cifras
          </p>
        </header>
        {detailEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin indicadores &gt; 0.</p>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {detailEntries.map((item) => (
              <li
                key={item.id}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium tabular-nums">{item.value}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
