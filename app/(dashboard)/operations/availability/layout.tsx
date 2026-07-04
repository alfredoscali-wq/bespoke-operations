"use client"

import { AvailabilityModuleProviders } from "@/components/providers/availability-module-providers"

export default function AvailabilityLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AvailabilityModuleProviders>{children}</AvailabilityModuleProviders>
}
