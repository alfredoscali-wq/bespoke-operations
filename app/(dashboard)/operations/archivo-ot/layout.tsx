"use client"

import { TasksModuleProviders } from "@/components/providers/tasks-module-providers"

export default function ArchivoOtLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <TasksModuleProviders listScope="archiveWorkOrders">{children}</TasksModuleProviders>
}
