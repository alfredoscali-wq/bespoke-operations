import type {
  AssignmentStatus,
  MaterialCategory,
  MaterialStatus,
  MovementType,
} from "@/lib/types/materials"
import {
  ASSIGNMENT_STATUS_LABELS,
  ASSIGNMENT_STATUS_STYLES,
  MATERIAL_CATEGORY_LABELS,
  MATERIAL_CATEGORY_STYLES,
  MATERIAL_STATUS_LABELS,
  MATERIAL_STATUS_STYLES,
  MOVEMENT_TYPE_LABELS,
  MOVEMENT_TYPE_STYLES,
} from "@/lib/materials/constants"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export function MaterialCategoryBadge({
  category,
  className,
}: {
  category: MaterialCategory
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", MATERIAL_CATEGORY_STYLES[category], className)}
    >
      {MATERIAL_CATEGORY_LABELS[category]}
    </Badge>
  )
}

export function MaterialStatusBadge({
  status,
  className,
}: {
  status: MaterialStatus
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", MATERIAL_STATUS_STYLES[status], className)}
    >
      {MATERIAL_STATUS_LABELS[status]}
    </Badge>
  )
}

export function MovementTypeBadge({
  type,
  className,
}: {
  type: MovementType
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", MOVEMENT_TYPE_STYLES[type], className)}
    >
      {MOVEMENT_TYPE_LABELS[type]}
    </Badge>
  )
}

export function AssignmentStatusBadge({
  status,
  className,
}: {
  status: AssignmentStatus
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", ASSIGNMENT_STATUS_STYLES[status], className)}
    >
      {ASSIGNMENT_STATUS_LABELS[status]}
    </Badge>
  )
}
