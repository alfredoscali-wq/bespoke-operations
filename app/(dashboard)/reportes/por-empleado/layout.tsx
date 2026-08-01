"use client"

import { ReportesModuleProviders } from "@/components/providers/reportes-module-providers"

/**
 * Por-empleado still needs the full operational provider stack.
 * Operativos does not — it uses lean Analysis selects.
 */
export default function ReportesPorEmpleadoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ReportesModuleProviders>{children}</ReportesModuleProviders>
}
