"use client"

import { CrewsProvider } from "@/components/cuadrillas/crews-provider"
import { ProjectsProvider } from "@/components/obras/projects-provider"
import { EmployeesProvider } from "@/components/rrhh/employees-provider"
import { TasksProvider } from "@/components/tareas/tasks-provider"

export function ReportesModuleProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProjectsProvider>
      <EmployeesProvider>
        <TasksProvider>
          <CrewsProvider>{children}</CrewsProvider>
        </TasksProvider>
      </EmployeesProvider>
    </ProjectsProvider>
  )
}
