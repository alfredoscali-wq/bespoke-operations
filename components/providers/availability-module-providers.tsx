"use client"

import { EmployeesAvailabilityStack } from "@/components/providers/internal/operational-provider-stacks"

export function AvailabilityModuleProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return <EmployeesAvailabilityStack>{children}</EmployeesAvailabilityStack>
}
