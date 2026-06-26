"use client"

import { CrewsProvider } from "@/components/cuadrillas/crews-provider"
import { AvailabilityProvider } from "@/components/disponibilidad/availability-provider"
import { ProjectsProvider } from "@/components/obras/projects-provider"
import { EmployeesProvider } from "@/components/rrhh/employees-provider"
import { TasksProvider } from "@/components/tareas/tasks-provider"

export function CalendarModuleProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProjectsProvider>
      <EmployeesProvider>
        <TasksProvider>
          <AvailabilityProvider>
            <CrewsProvider>{children}</CrewsProvider>
          </AvailabilityProvider>
        </TasksProvider>
      </EmployeesProvider>
    </ProjectsProvider>
  )
}
