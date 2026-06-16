"use client"

import {
  AVAILABILITY_TYPE_STYLES,
  formatAvailabilityDateRange,
  OPERATIONAL_AVAILABILITY_LABELS,
} from "@/lib/availability/constants"
import {
  getActiveAvailabilityRecords,
  getCurrentAvailabilityStatus,
  toDateOnly,
} from "@/lib/availability/utils"
import type { EmployeeAvailability } from "@/lib/types/availability"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/ui/status-badge"

type MemberOperationalStatusProps = {
  employeeId?: string | null
  records: EmployeeAvailability[]
  referenceDate?: string
  className?: string
}

export function MemberOperationalStatus({
  employeeId,
  records,
  referenceDate = toDateOnly(),
  className,
}: MemberOperationalStatusProps) {
  if (!employeeId) {
    return (
      <StatusBadge className={cn(AVAILABILITY_TYPE_STYLES.AVAILABLE, className)}>
        {OPERATIONAL_AVAILABILITY_LABELS.AVAILABLE}
      </StatusBadge>
    )
  }

  const status = getCurrentAvailabilityStatus(
    employeeId,
    records,
    referenceDate
  )
  const activeAbsence =
    status === "AVAILABLE"
      ? undefined
      : getActiveAvailabilityRecords(records, employeeId, referenceDate).find(
          (record) => record.availabilityType === status
        )

  return (
    <div className={cn("space-y-1", className)}>
      <StatusBadge className={AVAILABILITY_TYPE_STYLES[status]}>
        {OPERATIONAL_AVAILABILITY_LABELS[status]}
      </StatusBadge>
      {activeAbsence ? (
        <p className="text-xs text-muted-foreground">
          {formatAvailabilityDateRange(
            activeAbsence.startDate,
            activeAbsence.endDate
          )}
        </p>
      ) : null}
    </div>
  )
}
