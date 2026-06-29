"use client"

import { PlanificacionModuleProviders } from "@/components/providers/planificacion-module-providers"

export default function PlanificacionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <PlanificacionModuleProviders>{children}</PlanificacionModuleProviders>
}
