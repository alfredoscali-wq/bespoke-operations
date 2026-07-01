"use client"

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

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { profile } = useOperationalProfile()
  const { sessionUser } = useAuth()
  const { title, subtitle } = getPageMetaForSession(
    pathname,
    profile,
    sessionUser
  )

  return (
    <>
      <ProfileHomeRedirect />
      <AppShell title={title} subtitle={subtitle}>
        <ModuleAccessGuard>{children}</ModuleAccessGuard>
      </AppShell>
    </>
  )
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <OperationalProfileProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </OperationalProfileProvider>
  )
}
