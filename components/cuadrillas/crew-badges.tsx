import type { CrewAvailabilityStatus, CrewStatus } from "@/lib/types/crews"
import {
  CREW_AVAILABILITY_STATUS_LABELS,
  CREW_AVAILABILITY_STATUS_STYLES,
  CREW_STATUS_LABELS,
  CREW_STATUS_STYLES,
  MEMBER_ACTIVE_LABEL,
  MEMBER_ACTIVE_STYLES,
  MEMBER_INACTIVE_LABEL,
  MEMBER_INACTIVE_STYLES,
} from "@/lib/crews/constants"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/ui/status-badge"

export function CrewStatusBadge({
  status,
  className,
}: {
  status: CrewStatus
  className?: string
}) {
  return (
    <StatusBadge className={cn(CREW_STATUS_STYLES[status], className)}>
      {CREW_STATUS_LABELS[status]}
    </StatusBadge>
  )
}

export function MemberActiveBadge({
  active,
  className,
}: {
  active: boolean
  className?: string
}) {
  return (
    <StatusBadge
      className={cn(
        active ? MEMBER_ACTIVE_STYLES : MEMBER_INACTIVE_STYLES,
        className
      )}
    >
      {active ? MEMBER_ACTIVE_LABEL : MEMBER_INACTIVE_LABEL}
    </StatusBadge>
  )
}

export function CrewAvailabilityBadge({
  status,
  className,
}: {
  status: CrewAvailabilityStatus
  className?: string
}) {
  return (
    <StatusBadge
      className={cn(CREW_AVAILABILITY_STATUS_STYLES[status], className)}
    >
      {CREW_AVAILABILITY_STATUS_LABELS[status]}
    </StatusBadge>
  )
}
