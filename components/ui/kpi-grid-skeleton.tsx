import {
  KpiCardGrid,
  KPI_GRID_LAYOUT,
} from "@/components/ui/kpi-card-grid"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type KpiGridSkeletonProps = {
  count?: number
  layout?: keyof typeof KPI_GRID_LAYOUT
  compact?: boolean
  className?: string
}

function KpiCardSkeleton({ compact = false }: { compact?: boolean }) {
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
      <Skeleton className="mt-3 h-3 w-32" />
    </div>
  )
}

export function KpiGridSkeleton({
  count = 4,
  layout = "standard",
  compact = false,
  className,
}: KpiGridSkeletonProps) {
  return (
    <KpiCardGrid layout={layout} className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <KpiCardSkeleton key={index} compact={compact} />
      ))}
    </KpiCardGrid>
  )
}

export function TableRowsSkeleton({
  rows = 6,
  columns = 5,
  className,
}: {
  rows?: number
  columns?: number
  className?: string
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-3">
          {Array.from({ length: columns }).map((__, colIndex) => (
            <Skeleton
              key={colIndex}
              className={cn("h-9 flex-1", colIndex === 0 && "max-w-[120px]")}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
