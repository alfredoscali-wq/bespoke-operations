"use client"

import { EmployeesTasksCrewsStack } from "@/components/providers/internal/operational-provider-stacks"

export function CuadrillasModuleProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return <EmployeesTasksCrewsStack>{children}</EmployeesTasksCrewsStack>
}
