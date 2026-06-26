import { cn } from "@/lib/utils"

export const KPI_GRID_LAYOUT = {
  /** Standard module KPI row (4 columns on xl). */
  standard: "grid gap-5 sm:grid-cols-2 xl:grid-cols-4",
  /** Operational task/project categories (up to 5–6 columns). */
  operational:
    "grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  /** Calendar week summary (5 columns). */
  calendar:
    "grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  /** RRHH compact primary row. */
  compact:
    "grid gap-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8",
  /** Dashboard status sections with many items. */
  wide: "grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
  /** Dashboard RRHH block. */
  triple: "grid gap-5 sm:grid-cols-2 xl:grid-cols-3",
} as const

type KpiCardGridProps = {
  children: React.ReactNode
  layout?: keyof typeof KPI_GRID_LAYOUT
  className?: string
}

export function KpiCardGrid({
  children,
  layout = "standard",
  className,
}: KpiCardGridProps) {
  return (
    <div className={cn(KPI_GRID_LAYOUT[layout], className)}>{children}</div>
  )
}
