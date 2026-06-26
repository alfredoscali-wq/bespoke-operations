"use client"

import { ClientesSectionNav } from "@/components/clientes/clientes-section-nav"

export default function ClientesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <ClientesSectionNav />
      {children}
    </>
  )
}
