"use client"

import { ProjectsEmployeesTasksAvailabilityCrewsStack } from "@/components/providers/internal/operational-provider-stacks"

export function CalendarModuleProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProjectsEmployeesTasksAvailabilityCrewsStack>
      {children}
    </ProjectsEmployeesTasksAvailabilityCrewsStack>
  )
}
