import { DashboardHomeProviders } from "@/components/providers/dashboard-home-providers"
import { DashboardPageClient } from "@/components/dashboard/dashboard-page-client"

export default function DashboardPage() {
  return (
    <DashboardHomeProviders>
      <DashboardPageClient />
    </DashboardHomeProviders>
  )
}
