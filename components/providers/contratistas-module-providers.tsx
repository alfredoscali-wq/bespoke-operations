"use client"

import { ContractorsProvider } from "@/components/contratistas/contractors-provider"
import { EmployeesTasksCrewsStack } from "@/components/providers/internal/operational-provider-stacks"

export function ContratistasModuleProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <EmployeesTasksCrewsStack>
      <ContractorsProvider>{children}</ContractorsProvider>
    </EmployeesTasksCrewsStack>
  )
}
