import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { EvidenceProvider } from "@/components/evidencias/evidence-provider"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <EvidenceProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </EvidenceProvider>
  )
}
