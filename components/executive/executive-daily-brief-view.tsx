"use client"

import type { ReactNode } from "react"
import Link from "next/link"

import {
  formatActivityTimelineDate,
  formatActivityTimelineTime,
} from "@/lib/activity/activity-timeline-groups"
import type { ExecutiveDailyBrief } from "@/lib/executive/build-daily-brief"
import { cn } from "@/lib/utils"

function formatGeneratedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(date)
}

function Section({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}

export function ExecutiveDailyBriefView({
  daily,
  isLoading,
  className,
  timelineHref,
}: {
  daily: ExecutiveDailyBrief | null
  isLoading?: boolean
  className?: string
  /** Optional link to Timeline evidence for the same date. */
  timelineHref?: string
}) {
  if (isLoading || !daily) {
    return (
      <div className={cn("space-y-6", className)}>
        <p className="text-sm text-muted-foreground">
          Preparando el resumen ejecutivo…
        </p>
      </div>
    )
  }

  const { brief } = daily
  const dateLabel =
    formatActivityTimelineDate(`${brief.date}T12:00:00`) || brief.date

  return (
    <article
      className={cn(
        "mx-auto max-w-2xl space-y-10 text-[15px] leading-relaxed",
        className
      )}
    >
      <header className="space-y-1 border-b pb-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Resumen ejecutivo diario
        </p>
        <h1 className="text-xl font-semibold tracking-tight">
          ¿Qué ocurrió hoy en la empresa?
        </h1>
        <p className="text-sm text-muted-foreground">{dateLabel}</p>
      </header>

      <Section title="1. Resumen ejecutivo">
        <div className="space-y-2 text-foreground">
          {daily.summaryLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </Section>

      <Section title="2. Producción">
        {brief.production.length === 0 ? (
          <p className="text-muted-foreground">
            Sin producción relevante en la jornada.
          </p>
        ) : (
          <div className="space-y-6">
            {brief.production.map((block) => (
              <div key={block.id} className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {block.title}
                </h3>
                <ul className="space-y-1">
                  {block.metrics.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-baseline justify-between gap-4"
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
      </Section>

      <Section title="3. Estado operativo">
        {brief.operationalAlerts.length === 0 ? (
          <p className="text-muted-foreground">Sin novedades críticas.</p>
        ) : (
          <ul className="space-y-1.5">
            {brief.operationalAlerts.map((alert) => (
              <li
                key={alert.id}
                className="flex items-baseline justify-between gap-4"
              >
                <span>{alert.label}</span>
                <span className="font-semibold tabular-nums">{alert.value}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="4. Riesgos">
        {daily.risks.length === 0 ? (
          <p className="text-muted-foreground">
            No se identificaron riesgos operativos a partir de la jornada.
          </p>
        ) : (
          <ul className="list-disc space-y-1.5 pl-5">
            {daily.risks.map((risk) => (
              <li key={risk.id}>{risk.text}</li>
            ))}
          </ul>
        )}
      </Section>

      {daily.highlights.length > 0 ? (
        <Section title="5. Actividad destacada">
          <ul className="list-disc space-y-1.5 pl-5">
            {daily.highlights.map((item) => (
              <li key={item.id}>{item.text}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="6. Pendientes para mañana">
        {daily.tomorrow.length === 0 ? (
          <p className="text-muted-foreground">
            No hay pendientes automáticos para el día siguiente.
          </p>
        ) : (
          <ul className="list-disc space-y-1.5 pl-5">
            {daily.tomorrow.map((item) => (
              <li key={item.id}>{item.text}</li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="7. Cierre">
        <p className="text-sm text-muted-foreground">
          Generado el {formatGeneratedAt(daily.generatedAt)}.
        </p>
        {brief.firstEventAt || brief.lastEventAt ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Actividad observada
            {brief.firstEventAt
              ? ` desde las ${formatActivityTimelineTime(brief.firstEventAt)}`
              : ""}
            {brief.lastEventAt
              ? ` hasta las ${formatActivityTimelineTime(brief.lastEventAt)}`
              : ""}
            .
          </p>
        ) : null}
        {timelineHref ? (
          <p className="mt-3 text-sm">
            <Link
              href={timelineHref}
              className="text-foreground underline underline-offset-4"
            >
              Ver Timeline (evidencia)
            </Link>
          </p>
        ) : null}
      </Section>
    </article>
  )
}
