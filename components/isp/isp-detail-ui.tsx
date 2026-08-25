import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { Network, Package, Receipt } from "lucide-react"

import { KpiCard } from "@/components/ui/kpi-card"
import { KpiCardGrid } from "@/components/ui/kpi-card-grid"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export function IspSectionHeader({
  icon: Icon,
  title,
  action,
}: {
  icon?: LucideIcon
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {Icon ? (
          <Icon className="size-4 text-muted-foreground" aria-hidden />
        ) : null}
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  )
}

export function IspInfoRow({
  icon: Icon,
  label,
  value,
        toneClassName = "bg-blue-500/10 text-blue-700 dark:text-blue-300",
}: {
  icon: LucideIcon
  label: string
  value: ReactNode
  toneClassName?: string
}) {
  return (
    <div className="flex min-w-0 gap-3">
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          toneClassName
        )}
      >
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <div className="truncate text-sm font-medium">{value}</div>
      </div>
    </div>
  )
}

export function IspEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
      ) : null}
      {action}
    </div>
  )
}

export function IspCustomerSummaryCards({
  serviceCount,
  connectionCount,
  abonoLabel,
}: {
  serviceCount: number
  connectionCount: number
  abonoLabel: string
}) {
  return (
    <KpiCardGrid className="gap-2 sm:grid-cols-3 xl:grid-cols-3" layout="triple">
      <KpiCard
        compact
        label="Servicios"
        value={serviceCount}
        icon={Package}
        tone="blue"
      />
      <KpiCard
        compact
        label="Conexiones"
        value={connectionCount}
        icon={Network}
        tone="violet"
      />
      <KpiCard
        compact
        label="Abono"
        value={abonoLabel}
        icon={Receipt}
        tone="neutral"
      />
    </KpiCardGrid>
  )
}

export function IspDetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-64" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>
        <div className="mt-4 flex gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-36" />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
      <Skeleton className="h-9 w-full max-w-md rounded-lg" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
    </div>
  )
}
