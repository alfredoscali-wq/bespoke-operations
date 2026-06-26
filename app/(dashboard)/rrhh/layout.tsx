"use client"

import { EmployeesProvider } from "@/components/rrhh/employees-provider"

export default function RrhhLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <EmployeesProvider>{children}</EmployeesProvider>
}
