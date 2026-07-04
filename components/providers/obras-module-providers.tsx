"use client"

import { EvidenceProvider } from "@/components/evidencias/evidence-provider"
import { ProjectsEmployeesTasksCrewsStack } from "@/components/providers/internal/operational-provider-stacks"

export function ObrasModuleProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProjectsEmployeesTasksCrewsStack>
      <EvidenceProvider>{children}</EvidenceProvider>
    </ProjectsEmployeesTasksCrewsStack>
  )
}
