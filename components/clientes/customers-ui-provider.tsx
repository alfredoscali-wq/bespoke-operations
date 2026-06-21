"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import { useCustomers } from "@/components/clientes/customers-provider"
import {
  countCustomersByCategory,
  filterCustomersByCategory,
  type CustomerCategory,
} from "@/lib/customers/customer-category"
import type { Customer } from "@/lib/types/customers"

type CustomersUIContextValue = {
  selectedCategory: CustomerCategory | null
  openCategory: (category: CustomerCategory) => void
  closeCategory: () => void
  filteredCustomers: Customer[]
  categorySummary: Record<CustomerCategory, number>
}

const CustomersUIContext = createContext<CustomersUIContextValue | null>(null)

export function CustomersUIProvider({ children }: { children: React.ReactNode }) {
  const { customers } = useCustomers()
  const [selectedCategory, setSelectedCategory] =
    useState<CustomerCategory | null>(null)

  const categorySummary = useMemo(
    () => countCustomersByCategory(customers),
    [customers]
  )

  const filteredCustomers = useMemo(() => {
    return filterCustomersByCategory(customers, selectedCategory)
  }, [customers, selectedCategory])

  const openCategory = useCallback((category: CustomerCategory) => {
    setSelectedCategory((current) => (current === category ? null : category))
  }, [])

  const closeCategory = useCallback(() => {
    setSelectedCategory(null)
  }, [])

  const value = useMemo(
    () => ({
      selectedCategory,
      openCategory,
      closeCategory,
      filteredCustomers,
      categorySummary,
    }),
    [
      selectedCategory,
      openCategory,
      closeCategory,
      filteredCustomers,
      categorySummary,
    ]
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
