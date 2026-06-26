"use client"

import { CrewsProvider } from "@/components/cuadrillas/crews-provider"
import { AvailabilityProvider } from "@/components/disponibilidad/availability-provider"
import { EvidenceProvider } from "@/components/evidencias/evidence-provider"
import { ProjectsProvider } from "@/components/obras/projects-provider"
import { EmployeesProvider } from "@/components/rrhh/employees-provider"
import { TasksProvider } from "@/components/tareas/tasks-provider"

export function DashboardHomeProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProjectsProvider>
      <TasksProvider>
        <EmployeesProvider>
          <AvailabilityProvider>
            <CrewsProvider>
              <EvidenceProvider>{children}</EvidenceProvider>
            </CrewsProvider>
          </AvailabilityProvider>
        </EmployeesProvider>
      </TasksProvider>
    </ProjectsProvider>
  )
}
