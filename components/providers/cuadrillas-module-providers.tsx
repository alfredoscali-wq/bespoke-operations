"use client"

import { CrewsProvider } from "@/components/cuadrillas/crews-provider"
import { EmployeesProvider } from "@/components/rrhh/employees-provider"
import { TasksProvider } from "@/components/tareas/tasks-provider"

export function CuadrillasModuleProviders({
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
