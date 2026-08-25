import type { ReactNode } from "react"

import { StatusBadge } from "@/components/ui/status-badge"
import {
  ISP_COMMERCIAL_STATUS_LABELS,
  ISP_COMMERCIAL_STATUS_TONES,
  ISP_TECHNICAL_STATUS_LABELS,
  ISP_TECHNICAL_STATUS_TONES,
} from "@/lib/isp/labels"
import type { IspCommercialStatus, IspTechnicalStatus } from "@/lib/isp/constants"
import {
  STATUS_DOT_STYLES,
  STATUS_TONE_STYLES,
  type VisualTone,
} from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

export function IspStatusDot({
  tone,
  className,
}: {
  tone: VisualTone
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-1.5 shrink-0 rounded-full transition-colors",
        STATUS_DOT_STYLES[tone],
        className
      )}
    />
  )
}

export function IspTonedStatusBadge({
  tone,
  children,
  className,
}: {
  tone: VisualTone
  children: ReactNode
  className?: string
}) {
  return (
    <StatusBadge className={cn("gap-1.5", STATUS_TONE_STYLES[tone], className)}>
      <IspStatusDot tone={tone} />
      {children}
    </StatusBadge>
  )
}

export function IspCommercialStatusBadge({
  status,
}: {
  status: IspCommercialStatus
}) {
  return (
    <IspTonedStatusBadge tone={ISP_COMMERCIAL_STATUS_TONES[status]}>
      {ISP_COMMERCIAL_STATUS_LABELS[status]}
    </IspTonedStatusBadge>
  )
}

export function IspTechnicalStatusBadge({
  status,
}: {
  status: IspTechnicalStatus
}) {
  return (
    <IspTonedStatusBadge tone={ISP_TECHNICAL_STATUS_TONES[status]}>
      {ISP_TECHNICAL_STATUS_LABELS[status]}
    </IspTonedStatusBadge>
  )
}
