import type {
  AvailabilitySummary,
  AvailabilityType,
  EmployeeAvailability,
  EmployeeAvailabilityListItem,
  AvailabilityPeriodStatus,
} from "@/lib/types/availability"

const ABSENCE_TYPES: AvailabilityType[] = [
  "VACATION",
  "SICK_LEAVE",
  "TRAINING",
  "LICENSE",
  "OTHER",
]

export function toDateOnly(value: Date = new Date()): string {
  return value.toISOString().slice(0, 10)
}

export { parseDateOnlyForDisplay } from "@/lib/dates/date-only"

export function isDateWithinRange(
  date: string,
  startDate: string,
  endDate: string
): boolean {
  return date >= startDate && date <= endDate
}

export function getAvailabilityPeriodStatus(
  record: Pick<EmployeeAvailability, "startDate" | "endDate">,
  referenceDate: string = toDateOnly()
): AvailabilityPeriodStatus {
  if (referenceDate < record.startDate) return "scheduled"
  if (referenceDate > record.endDate) return "finished"
  return "active"
}

export function getActiveAvailabilityRecords(
  records: EmployeeAvailability[],
  employeeId: string,
  referenceDate: string = toDateOnly()
): EmployeeAvailability[] {
  return records.filter(
    (record) =>
      record.employeeId === employeeId &&
      isDateWithinRange(referenceDate, record.startDate, record.endDate)
  )
}

/**
 * Resolves current availability for planning modules (calendar, crews, tasks).
 * Returns AVAILABLE when no active absence window exists for the reference date.
 */
export function getCurrentAvailabilityStatus(
  employeeId: string,
  records: EmployeeAvailability[],
  referenceDate: string = toDateOnly()
): AvailabilityType {
  const activeRecords = getActiveAvailabilityRecords(
    records,
    employeeId,
    referenceDate
  )

  const absence = activeRecords.find((record) =>
    ABSENCE_TYPES.includes(record.availabilityType)
  )

  if (absence) {
    return absence.availabilityType
  }

  const explicitAvailable = activeRecords.find(
    (record) => record.availabilityType === "AVAILABLE"
  )

  return explicitAvailable?.availabilityType ?? "AVAILABLE"
}

export function buildAvailabilityListItem(
  record: EmployeeAvailability,
  employeeName: string,
  employeeCode: string,
  referenceDate: string = toDateOnly()
): EmployeeAvailabilityListItem {
  return {
    ...record,
    employeeName,
    employeeCode,
    periodStatus: getAvailabilityPeriodStatus(record, referenceDate),
  }
}

export function getAvailabilitySummary(
  records: EmployeeAvailability[],
  employeeIds: string[],
  referenceDate: string = toDateOnly()
): AvailabilitySummary {
  const activeToday = records.filter((record) =>
    isDateWithinRange(referenceDate, record.startDate, record.endDate)
  )

  const availableEmployees = employeeIds.filter(
    (employeeId) =>
      getCurrentAvailabilityStatus(employeeId, records, referenceDate) ===
      "AVAILABLE"
  ).length

  return {
    available: availableEmployees,
    vacation: activeToday.filter(
      (record) => record.availabilityType === "VACATION"
    ).length,
    licenses: activeToday.filter((record) =>
      ["SICK_LEAVE", "LICENSE"].includes(record.availabilityType)
    ).length,
    training: activeToday.filter(
      (record) => record.availabilityType === "TRAINING"
    ).length,
    total: records.length,
  }
}

export function validateAvailabilityInput(input: {
  employeeId?: string
  startDate?: string
  endDate?: string
  availabilityType?: AvailabilityType
}): string | null {
  if (!input.employeeId?.trim()) {
    return "Seleccione un empleado."
  }

  if (!input.availabilityType) {
    return "Seleccione un tipo de disponibilidad."
  }

  if (!input.startDate || !input.endDate) {
    return "Las fechas de inicio y fin son obligatorias."
  }

  if (input.endDate < input.startDate) {
    return "La fecha fin debe ser mayor o igual a la fecha inicio."
  }

  return null
}
