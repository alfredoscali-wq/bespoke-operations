"use client"

import { ProjectsEmployeesTasksCrewsStack } from "@/components/providers/internal/operational-provider-stacks"

export function ReportesModuleProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProjectsEmployeesTasksCrewsStack>{children}</ProjectsEmployeesTasksCrewsStack>
  )
}
