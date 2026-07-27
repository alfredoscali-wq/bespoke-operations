"use client"

import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type CommercialSectionAccent =
  | "blue"
  | "red"
  | "amber"
  | "violet"
  | "slate"
  | "green"

const SECTION_ACCENT: Record<
  CommercialSectionAccent,
  { bar: string; iconWrap: string; icon: string }
> = {
  blue: {
    bar: "bg-blue-500/70",
    iconWrap: "bg-blue-500/[0.08]",
    icon: "text-blue-700",
  },
  red: {
    bar: "bg-red-500/70",
    iconWrap: "bg-red-500/[0.08]",
    icon: "text-red-700",
  },
  amber: {
    bar: "bg-amber-500/70",
    iconWrap: "bg-amber-500/[0.08]",
    icon: "text-amber-800",
  },
  violet: {
    bar: "bg-violet-500/60",
    iconWrap: "bg-violet-500/[0.08]",
    icon: "text-violet-700",
  },
  slate: {
    bar: "bg-slate-400/80",
    iconWrap: "bg-slate-500/[0.08]",
    icon: "text-slate-700",
  },
  green: {
    bar: "bg-emerald-500/70",
    iconWrap: "bg-emerald-500/[0.08]",
    icon: "text-emerald-700",
  },
}

type CommercialSectionCardProps = {
  title: string
  description?: string
  children: React.ReactNode
  action?: React.ReactNode
  icon?: LucideIcon
  accent?: CommercialSectionAccent
  className?: string
}

export function CommercialSectionCard({
  title,
  description,
  children,
  action,
  icon: Icon,
  accent = "slate",
  className,
}: CommercialSectionCardProps) {
  const styles = SECTION_ACCENT[accent]
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-sm",
        className
      )}
    >
      <div className={cn("h-0.5 w-full", styles.bar)} aria-hidden />
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            {Icon ? (
              <div
                className={cn(
                  "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
                  styles.iconWrap
                )}
              >
                <Icon className={cn("size-4", styles.icon)} aria-hidden />
              </div>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
              {description ? (
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          {action}
        </div>
        <div className="pt-0.5">{children}</div>
      </div>
    </section>
  )
}

type CommercialEmptyStateProps = {
  icon: LucideIcon
  title: string
  description: string
  className?: string
}

export function CommercialEmptyState({
  icon: Icon,
  title,
  description,
  className,
}: CommercialEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-lg bg-muted/25 px-4 py-6 text-center",
        className
      )}
    >
      <div className="mb-1 flex size-9 items-center justify-center rounded-full bg-background shadow-sm">
        <Icon className="size-4 text-muted-foreground" aria-hidden />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-[28ch] text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  )
}
