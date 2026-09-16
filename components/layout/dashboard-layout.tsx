"use client"

import type { CSSProperties } from "react"
import { usePathname } from "next/navigation"

import { ModuleAccessGuard } from "@/components/auth/module-access-guard"
import { AppShell } from "@/components/layout/app-shell"
import {
  OperationalProfileProvider,
  useOperationalProfile,
  getPageMetaForSession,
} from "@/components/operations/operational-profile-provider"
import { ProfileHomeRedirect } from "@/components/operations/profile-home-redirect"
import { useAuth } from "@/components/auth/auth-provider"
import { AnalysisQueryProvider } from "@/lib/analysis/react-query"

function DashboardLayoutContent({
  children,
  logoSrc,
  logoAlt,
  brandingStyle,
}: {
  children: React.ReactNode
  logoSrc?: string
  logoAlt?: string
  brandingStyle?: CSSProperties
}) {
  const pathname = usePathname()
  const { profile } = useOperationalProfile()
  const { sessionUser } = useAuth()
  const { title, subtitle } = getPageMetaForSession(
    pathname,
    profile,
    sessionUser
  )

  return (
    <div style={brandingStyle}>
      <ProfileHomeRedirect />
      <AppShell title={title} subtitle={subtitle} logoSrc={logoSrc} logoAlt={logoAlt}>
        <ModuleAccessGuard>{children}</ModuleAccessGuard>
      </AppShell>
    </div>
  )
}

export function DashboardLayout({
  children,
  logoSrc,
  logoAlt,
  brandingStyle,
}: {
  children: React.ReactNode
  logoSrc?: string
  logoAlt?: string
  brandingStyle?: CSSProperties
}) {
  return (
    <OperationalProfileProvider>
      <AnalysisQueryProvider>
        <DashboardLayoutContent
          logoSrc={logoSrc}
          logoAlt={logoAlt}
          brandingStyle={brandingStyle}
        >
          {children}
        </DashboardLayoutContent>
      </AnalysisQueryProvider>
    </OperationalProfileProvider>
  )
}
