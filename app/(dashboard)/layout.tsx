import { headers } from "next/headers"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { getAppLogoAlt, getAppLogoSrc } from "@/lib/branding/logo"
import { loadAuthenticatedChromeBranding } from "@/lib/company-branding/load-authenticated-chrome.server"

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const host = (await headers()).get("host")
  const instanceLogoSrc = getAppLogoSrc(host)
  const instanceLogoAlt = getAppLogoAlt(host)
  const chrome = await loadAuthenticatedChromeBranding({
    instanceLogoSrc,
    instanceLogoAlt,
  })

  return (
    <DashboardLayout
      logoSrc={chrome.logoSrc}
      logoAlt={chrome.logoAlt}
      brandingStyle={chrome.style}
    >
      {children}
    </DashboardLayout>
  )
}
