"use client"

import { EntityProductionView } from "@/components/executive/entity-production-view"
import { EMPLOYEE_DAILY_REPORT_FILTERS } from "@/lib/activity/activity-timeline-types"
import { getEmployeeDisplayName } from "@/lib/employees/utils"
import type { Employee } from "@/lib/types/employees"

type EmployeeDailyReportProps = {
  employee: Employee
  initialDate?: string
}

/** @deprecated Prefer EntityProductionView — kept as employee Producción entry. */
export function EmployeeDailyReport({
  employee,
  initialDate,
}: EmployeeDailyReportProps) {
  return (
    <EntityProductionView
      timelineScope={{ kind: "employee", employeeId: employee.id }}
      timelineFilters={EMPLOYEE_DAILY_REPORT_FILTERS}
      title="Producción"
      subtitle="Resumen → Producción → Detalle → Timeline"
      entityLabel={getEmployeeDisplayName(employee)}
      initialDate={initialDate}
    />
  )
}
