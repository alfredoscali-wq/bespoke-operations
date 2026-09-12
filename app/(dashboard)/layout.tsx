import { headers } from "next/headers"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { getAppLogoAlt, getAppLogoSrc } from "@/lib/branding/logo"

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const host = (await headers()).get("host")

  return (
    <DashboardLayout logoSrc={getAppLogoSrc(host)} logoAlt={getAppLogoAlt(host)}>
      {children}
    </DashboardLayout>
  )
}
