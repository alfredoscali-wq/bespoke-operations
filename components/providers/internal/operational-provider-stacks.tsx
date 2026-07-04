"use client"

import { CrewsProvider } from "@/components/cuadrillas/crews-provider"
import { AvailabilityProvider } from "@/components/disponibilidad/availability-provider"
import { ProjectsProvider } from "@/components/obras/projects-provider"
import { EmployeesProvider } from "@/components/rrhh/employees-provider"
import { TasksProvider } from "@/components/tareas/tasks-provider"

/**
 * Shared provider nesting used by multiple module layouts.
 * Not a public API — import module providers from `@/components/providers/*`.
 */
export function EmployeesTasksCrewsStack({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <EmployeesProvider>
      <TasksProvider>
        <CrewsProvider>{children}</CrewsProvider>
      </TasksProvider>
    </EmployeesProvider>
  )
}

export function ProjectsEmployeesTasksCrewsStack({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProjectsProvider>
      <EmployeesTasksCrewsStack>{children}</EmployeesTasksCrewsStack>
    </ProjectsProvider>
  )
}

export function ProjectsEmployeesTasksAvailabilityCrewsStack({
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

export function EmployeesAvailabilityStack({
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
