import {
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_STATUS_STYLES,
  EMPLOYEE_TYPE_LABELS,
  EMPLOYEE_TYPE_STYLES,
  SYSTEM_ROLE_LABELS,
  SYSTEM_ROLE_STYLES,
} from "@/lib/employees/constants"
import type {
  EmployeeType,
  EmploymentStatus,
  SystemRole,
} from "@/lib/types/employees"
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

export function SystemRoleBadge({
  systemRole,
  className,
}: {
  systemRole: SystemRole
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", SYSTEM_ROLE_STYLES[systemRole], className)}
    >
      {SYSTEM_ROLE_LABELS[systemRole]}
    </Badge>
  )
}
