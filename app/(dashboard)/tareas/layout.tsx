"use client"

import { TasksModuleProviders } from "@/components/providers/tasks-module-providers"

export default function TareasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <TasksModuleProviders>{children}</TasksModuleProviders>
}
