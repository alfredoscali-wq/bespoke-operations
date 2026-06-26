"use client"

import { CalendarModuleProviders } from "@/components/providers/calendar-module-providers"

export default function CalendarLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <CalendarModuleProviders>{children}</CalendarModuleProviders>
}
