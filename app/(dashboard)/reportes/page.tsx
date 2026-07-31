import { redirect } from "next/navigation"

/**
 * Legacy entry `/reportes` (Dashboard Ejecutivo hub).
 * Sidebar now opens Reportes Operativos directly; keep the hub page code
 * under reports-dashboard-module for later reuse.
 */
export default function ReportesPage() {
  redirect("/reportes/operativos")
}
