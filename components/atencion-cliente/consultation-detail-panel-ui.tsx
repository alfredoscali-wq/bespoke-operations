"use client"

import type { LucideIcon } from "lucide-react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { VisualTone } from "@/lib/ui/visual-tokens"
import { KPI_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

type PanelSectionCardProps = {
  title: string
  icon: LucideIcon
  tone?: VisualTone
  description?: string
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

/**
 * Soft-tinted section card for the contextual consultation detail panel.
 * Compact CRM density — presentation only.
 */
export function PanelSectionCard({
  title,
  icon: Icon,
  tone = "neutral",
  description,
  children,
  className,
  contentClassName,
}: PanelSectionCardProps) {
  const styles = KPI_TONE_STYLES[tone]

  return (
    <Card className={cn("overflow-hidden shadow-sm", styles.card, className)}>
      <CardHeader className="border-b border-border/30 bg-background/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-md",
              styles.icon
            )}
          >
            <Icon className={cn("size-3.5", styles.iconColor)} />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-[13px] font-semibold leading-none tracking-tight">
              {title}
            </CardTitle>
            {description ? (
              <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn("px-3 py-2", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}

type PanelFieldProps = {
  label: string
  value: React.ReactNode
  className?: string
}

/** Compact label/value pair for CRM-style scanning. */
export function PanelField({ label, value, className }: PanelFieldProps) {
  return (
    <div className={cn("min-w-0 space-y-0.5", className)}>
      <p className="text-[10px] leading-none text-muted-foreground">{label}</p>
      <div className="text-[13px] font-medium leading-snug text-foreground">
        {value}
      </div>
    </div>
  )
}

type PanelFieldGridProps = {
  children: React.ReactNode
  className?: string
}

/** Two-column dense field layout for short values. */
export function PanelFieldGrid({ children, className }: PanelFieldGridProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-3 gap-y-2.5", className)}>
      {children}
    </div>
  )
}

/** @deprecated Prefer PanelField + PanelFieldGrid for compact layouts. */
export function PanelFieldRow({
  label,
  value,
  isLast = false,
}: {
  label: string
  value: React.ReactNode
  isLast?: boolean
}) {
  return (
    <div
      className={cn(
        "space-y-0.5 py-1.5",
        !isLast && "border-b border-border/30"
      )}
    >
      <p className="text-[10px] leading-none text-muted-foreground">{label}</p>
      <div className="text-[13px] font-medium leading-snug text-foreground">
        {value}
      </div>
    </div>
  )
}
