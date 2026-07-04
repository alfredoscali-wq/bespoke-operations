"use client"

import { AvailabilityModuleProviders } from "@/components/providers/availability-module-providers"

export default function NovedadesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AvailabilityModuleProviders>{children}</AvailabilityModuleProviders>
}
