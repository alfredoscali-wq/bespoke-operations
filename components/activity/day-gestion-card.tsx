"use client"

import Link from "next/link"

import { formatDayActivityTimelineStamp } from "@/lib/activity/activity-timeline-groups"
import type { DayGestion, DayGestionStatusTone } from "@/lib/activity/day-gestiones"
import {
  DAY_GESTION_EMPHASIS_LABEL,
  resolveDayGestionEmphasis,
  type DayGestionEmphasis,
} from "@/lib/activity/day-activity-ux"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const TONE_STYLES: Record<
  DayGestionStatusTone,
  { dot: string; label: string }
> = {
  done: { dot: "bg-emerald-500", label: "text-emerald-700" },
  pending: { dot: "bg-amber-500", label: "text-amber-700" },
  new: { dot: "bg-sky-500", label: "text-sky-700" },
  cancelled: { dot: "bg-red-500", label: "text-red-700" },
}

const EMPHASIS_BORDER: Record<Exclude<DayGestionEmphasis, null>, string> = {
  workorder: "border-l-sky-600",
  sale: "border-l-emerald-600",
  retention: "border-l-amber-600",
  incident: "border-l-red-600",
  new_customer: "border-l-violet-600",
}

export function DayGestionCard({ gestion }: { gestion: DayGestion }) {
  const tone = TONE_STYLES[gestion.statusTone]
  const emphasis = resolveDayGestionEmphasis(gestion)

  return (
    <article
      className={cn(
        "rounded-xl border bg-card px-4 py-3 shadow-sm",
        emphasis ? cn("border-l-4", EMPHASIS_BORDER[emphasis]) : null
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs tabular-nums text-muted-foreground">
            {formatDayActivityTimelineStamp(gestion.startedAt)}
          </p>
          <h3 className="mt-0.5 text-sm font-semibold text-foreground">
            {gestion.title}
          </h3>
          {emphasis ? (
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {DAY_GESTION_EMPHASIS_LABEL[emphasis]}
            </p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium",
            tone.label
          )}
        >
          <span className={cn("size-2 rounded-full", tone.dot)} aria-hidden />
          {gestion.statusLabel}
        </div>
      </div>

      {gestion.fields.length > 0 ? (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {gestion.fields.map((field) => (
            <div key={`${field.label}:${field.value}`}>
              <dt className="text-xs text-muted-foreground">{field.label}</dt>
              <dd className="mt-0.5 text-foreground">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {gestion.links.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {gestion.links.map((link) => (
            <Button
              key={link.href}
              asChild
              variant="outline"
              size="sm"
              className="h-8"
            >
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </div>
      ) : null}
    </article>
  )
}
