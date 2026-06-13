"use client"

import { OperarioBottomNav } from "@/components/operario/operario-bottom-nav"
import { OperarioHeader } from "@/components/operario/operario-header"
import { OperarioProvider } from "@/components/operario/operario-provider"
import { TasksProvider } from "@/components/tareas/tasks-provider"

export function OperarioShell({ children }: { children: React.ReactNode }) {
  return (
    <TasksProvider>
      <OperarioProvider>
        <div className="min-h-dvh bg-[#f4f6f9]">
          <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
            <OperarioHeader />
            <main className="flex-1 pb-24">{children}</main>
            <OperarioBottomNav />
          </div>
        </div>
      </OperarioProvider>
    </TasksProvider>
  )
}
