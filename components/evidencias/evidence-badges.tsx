import type {
  EvidenceCategoryType,
  EvidenceFileType,
  EvidenceStatus,
} from "@/lib/types/evidence"
import {
  EVIDENCE_CATEGORY_LABELS,
  EVIDENCE_CATEGORY_STYLES,
  EVIDENCE_STATUS_LABELS,
  EVIDENCE_STATUS_STYLES,
  EVIDENCE_TYPE_LABELS,
  EVIDENCE_TYPE_STYLES,
} from "@/lib/evidence/constants"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export function EvidenceStatusBadge({
  status,
  className,
}: {
  status: EvidenceStatus
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", EVIDENCE_STATUS_STYLES[status], className)}
    >
      {EVIDENCE_STATUS_LABELS[status]}
    </Badge>
  )
}

export function EvidenceTypeBadge({
  type,
  className,
}: {
  type: EvidenceFileType
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", EVIDENCE_TYPE_STYLES[type], className)}
    >
      {EVIDENCE_TYPE_LABELS[type]}
    </Badge>
  )
}

export function EvidenceCategoryBadge({
  evidenceType,
  className,
}: {
  evidenceType: EvidenceCategoryType
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", EVIDENCE_CATEGORY_STYLES[evidenceType], className)}
    >
      {EVIDENCE_CATEGORY_LABELS[evidenceType]}
    </Badge>
  )
}
