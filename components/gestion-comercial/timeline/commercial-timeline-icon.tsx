"use client"

import { COMMERCIAL_ACTIVITY_TYPE_ICONS } from "@/components/gestion-comercial/commercial-activity-icons"
import { COMMERCIAL_ACTIVITY_TYPE_TONE } from "@/lib/commercial/timeline"
import type { CommercialActivityTypeCode } from "@/lib/commercial/activity-catalogs"
import { cn } from "@/lib/utils"

type CommercialTimelineIconProps = {
  typeCode: CommercialActivityTypeCode
  className?: string
}

export function CommercialTimelineIcon({
  typeCode,
  className,
}: CommercialTimelineIconProps) {
  const Icon = COMMERCIAL_ACTIVITY_TYPE_ICONS[typeCode]
  const tone = COMMERCIAL_ACTIVITY_TYPE_TONE[typeCode]

  return (
    <div
      className={cn(
        "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-background shadow-sm md:size-9",
        tone.icon,
        className
      )}
    >
      <Icon className="size-3.5 md:size-4" aria-hidden />
    </div>
  )
}
