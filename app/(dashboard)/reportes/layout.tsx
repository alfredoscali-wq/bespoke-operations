"use client"

import { ReportesModuleProviders } from "@/components/providers/reportes-module-providers"

export default function ReportesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ReportesModuleProviders>{children}</ReportesModuleProviders>
}
