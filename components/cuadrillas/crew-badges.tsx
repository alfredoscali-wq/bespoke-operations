import type { CrewStatus } from "@/lib/types/crews"
import {
  CREW_STATUS_LABELS,
  CREW_STATUS_STYLES,
  MEMBER_ACTIVE_LABEL,
  MEMBER_ACTIVE_STYLES,
  MEMBER_INACTIVE_LABEL,
  MEMBER_INACTIVE_STYLES,
} from "@/lib/crews/constants"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export function CrewStatusBadge({
  status,
  className,
}: {
  status: CrewStatus
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", CREW_STATUS_STYLES[status], className)}
    >
      {CREW_STATUS_LABELS[status]}
    </Badge>
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
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        active ? MEMBER_ACTIVE_STYLES : MEMBER_INACTIVE_STYLES,
        className
      )}
    >
      {active ? MEMBER_ACTIVE_LABEL : MEMBER_INACTIVE_LABEL}
    </Badge>
  )
}
