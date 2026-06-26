"use client"

import { EvidenciasModuleProviders } from "@/components/providers/evidencias-module-providers"

export default function EvidenciasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <EvidenciasModuleProviders>{children}</EvidenciasModuleProviders>
}
