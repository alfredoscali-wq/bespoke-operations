"use client"

import { usePathname } from "next/navigation"

import { AppShell } from "@/components/layout/app-shell"
import { OperationalProfileProvider, useOperationalProfile } from "@/components/operations/operational-profile-provider"
import { ProfileHomeRedirect } from "@/components/operations/profile-home-redirect"
import { getPageMetaForProfile } from "@/lib/navigation/profile-navigation"

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { profile } = useOperationalProfile()
  const { title, subtitle } = getPageMetaForProfile(pathname, profile)

  return (
    <>
      <ProfileHomeRedirect />
      <AppShell title={title} subtitle={subtitle}>
        {children}
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
