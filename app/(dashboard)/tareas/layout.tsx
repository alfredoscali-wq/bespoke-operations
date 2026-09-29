"use client"

import { TareasListScopeProvidersBoundary } from "@/components/tareas/tareas-list-scope-providers"

export default function TareasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <TareasListScopeProvidersBoundary>
      {children}
    </TareasListScopeProvidersBoundary>
  )
}
