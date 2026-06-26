"use client"

import { CustomersProvider } from "@/components/clientes/customers-provider"
import { CrewsProvider } from "@/components/cuadrillas/crews-provider"
import { ProjectsProvider } from "@/components/obras/projects-provider"
import { EmployeesProvider } from "@/components/rrhh/employees-provider"
import { TasksProvider } from "@/components/tareas/tasks-provider"

export function TasksModuleProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProjectsProvider>
      <CustomersProvider>
        <EmployeesProvider>
          <TasksProvider>
            <CrewsProvider>{children}</CrewsProvider>
          </TasksProvider>
        </EmployeesProvider>
      </CustomersProvider>
    </ProjectsProvider>
  )
}
