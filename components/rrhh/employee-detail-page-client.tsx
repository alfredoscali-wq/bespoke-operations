"use client"

import { notFound } from "next/navigation"

import { EmployeeDetailView } from "@/components/rrhh/employee-detail-view"
import { useEmployees } from "@/components/rrhh/employees-provider"

type EmployeeDetailPageClientProps = {
  id: string
}

export function EmployeeDetailPageClient({ id }: EmployeeDetailPageClientProps) {
  const { getEmployee, isEmployeesReady } = useEmployees()
  const employee = getEmployee(id)

  if (isEmployeesReady && !employee) {
    notFound()
  }

  if (!employee) {
    return null
  }

  return <EmployeeDetailView employee={employee} />
}
