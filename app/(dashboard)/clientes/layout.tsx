"use client"

import { CustomersProvider } from "@/components/clientes/customers-provider"
import { ClientesSectionNav } from "@/components/clientes/clientes-section-nav"

export default function ClientesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <CustomersProvider>
      <ClientesSectionNav />
      {children}
    </CustomersProvider>
  )
}
