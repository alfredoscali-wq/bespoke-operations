"use client"

import { AtencionClienteProvider } from "@/components/atencion-cliente/atencion-cliente-provider"

export default function AtencionClienteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AtencionClienteProvider>{children}</AtencionClienteProvider>
}
