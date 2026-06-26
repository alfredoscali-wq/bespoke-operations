"use client"

import { AvailabilityProvider } from "@/components/disponibilidad/availability-provider"
import { EmployeesProvider } from "@/components/rrhh/employees-provider"

export default function AvailabilityLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <EmployeesProvider>
      <AvailabilityProvider>{children}</AvailabilityProvider>
    </EmployeesProvider>
  )
}
