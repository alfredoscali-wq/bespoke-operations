"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { KpiCard } from "@/components/ui/kpi-card"
import { Skeleton } from "@/components/ui/skeleton"
import type { VisualTone } from "@/lib/ui/visual-tokens"
import { KPI_CARD_COMPACT_INTERACTION_CLASS, KPI_CARD_INTERACTION_CLASS } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

type FilterableKpiCardProps = {
  label: string
  value: number | string
  icon: LucideIcon
  tone?: VisualTone
  hint?: React.ReactNode
  compact?: boolean
  isActive?: boolean
  isLoading?: boolean
  href?: string
  onClick?: () => void
  disabled?: boolean
  ariaLabel?: string
  className?: string
  cardClassName?: string
}

const WRAPPER_CLASS =
  "rounded-xl text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"

const ACTIVE_CLASS = "ring-2 ring-primary/25"

function KpiCardSkeletonInline({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="rounded-xl border bg-card px-3 py-2.5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-10" />
          </div>
          <Skeleton className="size-7 shrink-0 rounded-md" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[7.5rem] flex-col rounded-xl border bg-card px-5 py-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-9 shrink-0 rounded-lg" />
      </div>
      <Skeleton className="mt-4 h-8 w-14" />
    </div>
  )
}

export function FilterableKpiCard({
  label,
  value,
  icon,
  tone = "neutral",
  hint,
  compact = false,
  isActive = false,
  isLoading = false,
  href,
  onClick,
  disabled = false,
  ariaLabel,
  className,
  cardClassName,
}: FilterableKpiCardProps) {
  const interactive = Boolean(href || onClick) && !disabled
  const resolvedAriaLabel =
    ariaLabel ?? (interactive ? `${label}: ${value}` : undefined)

  const card = isLoading ? (
    <KpiCardSkeletonInline compact={compact} />
  ) : (
    <KpiCard
      label={label}
      value={value}
      icon={icon}
      tone={tone}
      hint={hint}
      compact={compact}
      className={cn(
        compact ? KPI_CARD_COMPACT_INTERACTION_CLASS : KPI_CARD_INTERACTION_CLASS,
        interactive && "cursor-pointer",
        isActive && "shadow-md ring-1 ring-primary/20",
        !interactive && "cursor-default",
        cardClassName
      )}
    />
  )

  if (!interactive) {
    return <div className={cn(className)}>{card}</div>
  }

  const wrapperClass = cn(
    WRAPPER_CLASS,
    isActive && ACTIVE_CLASS,
    disabled && "pointer-events-none opacity-60",
    className
  )

  if (href) {
    return (
      <Link
        href={href}
        className={wrapperClass}
        aria-label={resolvedAriaLabel}
        aria-current={isActive ? "true" : undefined}
      >
        {card}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={wrapperClass}
      aria-label={resolvedAriaLabel}
      aria-pressed={isActive}
      disabled={disabled}
    >
      {card}
    </button>
  )
}
