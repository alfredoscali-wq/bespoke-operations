"use client"

import {
  createContext,
  useContext,
  useMemo,
} from "react"

import { useCustomers } from "@/components/clientes/customers-provider"
import { countCustomerOperationalSummary } from "@/lib/customers/customer-operational"
import type { CustomerOperationalSummary } from "@/lib/customers/customer-operational"

type CustomersUIContextValue = {
  operationalSummary: CustomerOperationalSummary
}

const CustomersUIContext = createContext<CustomersUIContextValue | null>(null)

export function CustomersUIProvider({ children }: { children: React.ReactNode }) {
  const { customers } = useCustomers()

  const operationalSummary = useMemo(
    () => countCustomerOperationalSummary(customers),
    [customers]
  )

  const value = useMemo(
    () => ({
      operationalSummary,
    }),
    [operationalSummary]
  )

  return (
    <CustomersUIContext.Provider value={value}>
      {children}
    </CustomersUIContext.Provider>
  )
}

export function useCustomersUI() {
  const context = useContext(CustomersUIContext)

  if (!context) {
    throw new Error("useCustomersUI must be used within CustomersUIProvider")
  }

  return context
}
