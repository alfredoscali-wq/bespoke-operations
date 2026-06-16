import {
  AVAILABILITY_TYPE_LABELS,
  AVAILABILITY_TYPE_STYLES,
} from "@/lib/availability/constants"
import type { AvailabilityType } from "@/lib/types/availability"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/ui/status-badge"

export function AvailabilityBadge({
  type,
  className,
}: {
  type: AvailabilityType
  className?: string
}) {
  return (
    <StatusBadge className={cn(AVAILABILITY_TYPE_STYLES[type], className)}>
      {AVAILABILITY_TYPE_LABELS[type]}
    </StatusBadge>
  )
}
