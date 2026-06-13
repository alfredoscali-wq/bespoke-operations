import type { CrewStatus, MemberStatus } from "@/lib/types/crews"
import {
  CREW_STATUS_LABELS,
  CREW_STATUS_STYLES,
  MEMBER_STATUS_LABELS,
  MEMBER_STATUS_STYLES,
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

export function MemberStatusBadge({
  status,
  className,
}: {
  status: MemberStatus
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", MEMBER_STATUS_STYLES[status], className)}
    >
      {MEMBER_STATUS_LABELS[status]}
    </Badge>
  )
}
