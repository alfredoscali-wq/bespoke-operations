"use client"

import { usePathname } from "next/navigation"

import { AppShell } from "@/components/layout/app-shell"
import { getPageMeta } from "@/lib/page-meta"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { title, subtitle } = getPageMeta(pathname)

  return (
    <AppShell title={title} subtitle={subtitle}>
      {children}
    </AppShell>
  )
}
