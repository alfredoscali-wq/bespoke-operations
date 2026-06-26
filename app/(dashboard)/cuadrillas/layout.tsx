"use client"

import { CuadrillasModuleProviders } from "@/components/providers/cuadrillas-module-providers"

export default function CuadrillasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <CuadrillasModuleProviders>{children}</CuadrillasModuleProviders>
}
