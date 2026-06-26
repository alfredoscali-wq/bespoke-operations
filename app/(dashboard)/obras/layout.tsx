"use client"

import { ObrasModuleProviders } from "@/components/providers/obras-module-providers"

export default function ObrasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ObrasModuleProviders>{children}</ObrasModuleProviders>
}
