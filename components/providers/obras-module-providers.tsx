"use client"

import { CrewsProvider } from "@/components/cuadrillas/crews-provider"
import { EvidenceProvider } from "@/components/evidencias/evidence-provider"
import { ProjectsProvider } from "@/components/obras/projects-provider"
import { EmployeesProvider } from "@/components/rrhh/employees-provider"
import { TasksProvider } from "@/components/tareas/tasks-provider"

export function ObrasModuleProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProjectsProvider>
      <EmployeesProvider>
        <TasksProvider>
          <CrewsProvider>
            <EvidenceProvider>{children}</EvidenceProvider>
          </CrewsProvider>
        </TasksProvider>
      </EmployeesProvider>
    </ProjectsProvider>
  )
}
