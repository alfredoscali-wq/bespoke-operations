import {
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_STATUS_STYLES,
  EMPLOYEE_TYPE_LABELS,
  EMPLOYEE_TYPE_STYLES,
} from "@/lib/employees/constants"
import type { EmployeeType, EmploymentStatus } from "@/lib/types/employees"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

export function EmploymentStatusBadge({
  status,
  className,
}: {
  status: EmploymentStatus
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        EMPLOYMENT_STATUS_STYLES[status],
        className
      )}
    >
      {EMPLOYMENT_STATUS_LABELS[status]}
    </Badge>
  )
}

export function EmployeeTypeBadge({
  employeeType,
  className,
}: {
  employeeType: EmployeeType
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", EMPLOYEE_TYPE_STYLES[employeeType], className)}
    >
      {EMPLOYEE_TYPE_LABELS[employeeType]}
    </Badge>
  )
}
