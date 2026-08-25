"use client"

import type { LucideIcon } from "lucide-react"
import {
  ClipboardList,
  History,
  MessageCircle,
  Network,
  Package,
  User,
} from "lucide-react"

import { IspEmptyState } from "@/components/isp/isp-detail-ui"
import type { IspActivityEvent } from "@/lib/isp/types"
import {
  formatIspTime,
  groupIspActivityByDay,
} from "@/lib/isp/detail-presentation"
import { cn } from "@/lib/utils"

const KIND_ICONS: Record<IspActivityEvent["kind"], LucideIcon> = {
  service: Package,
  connection: Network,
  admin: User,
  work_order: ClipboardList,
  atencion: MessageCircle,
}

const KIND_TONES: Record<IspActivityEvent["kind"], string> = {
  service: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  connection: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  admin: "bg-primary/10 text-primary",
  work_order: "bg-amber-500/10 text-amber-800 dark:text-amber-200",
  atencion: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
}

function TimelineItem({
  event,
  compact,
}: {
  event: IspActivityEvent
  compact?: boolean
}) {
  const Icon = KIND_ICONS[event.kind] ?? History
  return (
    <li className="group/item flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full",
            KIND_TONES[event.kind]
          )}
        >
          <Icon className="size-3.5" />
        </div>
        <span
          className="mt-1 w-px flex-1 bg-border/80 group-last/item:hidden"
          aria-hidden
        />
      </div>
      <div className="min-w-0 pb-4 group-last/item:pb-0">
        {compact ? (
          <p className="text-[11px] text-muted-foreground">
            {formatIspTime(event.occurredAt)}
          </p>
        ) : null}
        <p className="text-sm leading-snug">{event.label}</p>
      </div>
    </li>
  )
}

export function IspActivityTimeline({
  events,
  compact,
  emptyTitle = "Todavía no hay actividad registrada.",
}: {
  events: IspActivityEvent[]
  compact?: boolean
  emptyTitle?: string
}) {
  if (events.length === 0) {
    return <IspEmptyState icon={History} title={emptyTitle} />
  }

  if (compact) {
    return (
      <ol className="space-y-0">
        {events.map((event) => (
          <TimelineItem key={event.id} event={event} compact />
        ))}
      </ol>
    )
  }

  const grouped = groupIspActivityByDay(events)
  let lastYear = ""

  return (
    <div className="space-y-4">
      {grouped.map((group) => {
        const showYear = group.year && group.year !== lastYear
        lastYear = group.year
        return (
          <section key={group.dayKey} className="space-y-2">
            {showYear ? (
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">
                {group.year}
              </p>
            ) : null}
            <p className="text-[11px] font-medium uppercase text-muted-foreground">
              {group.dayLabel}
            </p>
            <ol>
              {group.events.map((event) => (
                <TimelineItem key={event.id} event={event} />
              ))}
            </ol>
          </section>
        )
      })}
    </div>
  )
}
