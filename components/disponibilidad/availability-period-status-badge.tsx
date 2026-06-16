import {
  AVAILABILITY_PERIOD_STATUS_LABELS,
  AVAILABILITY_PERIOD_STATUS_STYLES,
} from "@/lib/availability/constants"
import type { AvailabilityPeriodStatus } from "@/lib/types/availability"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/ui/status-badge"

export function AvailabilityPeriodStatusBadge({
  status,
  className,
}: {
  status: AvailabilityPeriodStatus
  className?: string
}) {
  return (
    <StatusBadge
      className={cn(AVAILABILITY_PERIOD_STATUS_STYLES[status], className)}
    >
      {AVAILABILITY_PERIOD_STATUS_LABELS[status]}
    </StatusBadge>
  )
}
