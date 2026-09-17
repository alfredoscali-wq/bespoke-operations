"use client"

import { CustomersProvider } from "@/components/clientes/customers-provider"
import { CrewsProvider } from "@/components/cuadrillas/crews-provider"
import { ProjectsProvider } from "@/components/obras/projects-provider"
import { EmployeesProvider } from "@/components/rrhh/employees-provider"
import { TasksProvider } from "@/components/tareas/tasks-provider"
import type { TasksListScope } from "@/components/tareas/tasks-provider/hooks/use-tasks-load"

export function TasksModuleProviders({
  children,
  listScope = "all",
}: {
  children: React.ReactNode
  listScope?: TasksListScope
}) {
  return (
    <ProjectsProvider>
      <CustomersProvider>
        <EmployeesProvider>
          <TasksProvider listScope={listScope}>
            <CrewsProvider>{children}</CrewsProvider>
          </TasksProvider>
        </EmployeesProvider>
      </CustomersProvider>
    </ProjectsProvider>
  )
}
