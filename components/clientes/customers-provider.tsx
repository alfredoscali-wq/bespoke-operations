"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  createBrowserCustomersClient,
  createCustomer as createCustomerInSupabase,
  deleteCustomer as deleteCustomerInSupabase,
  getCustomers as listCustomers,
  markCustomersAsActive as markCustomersAsActiveInSupabase,
  searchCustomers as searchCustomersInSupabase,
  updateCustomer as updateCustomerInSupabase,
} from "@/lib/supabase/customers.browser"
import type {
  Customer,
  NewCustomerInput,
  UpdateCustomerInput,
} from "@/lib/types/customers"

type CustomerMutationResult = {
  success: boolean
  message?: string
  customer?: Customer
}

type CustomersContextValue = {
  customers: Customer[]
  isCustomersReady: boolean
  usesSupabase: boolean
  getCustomer: (id: string) => Customer | undefined
  searchCustomers: (query: string, limit?: number) => Promise<Customer[]>
  createCustomer: (input: NewCustomerInput) => Promise<CustomerMutationResult>
  updateCustomer: (
    id: string,
    input: UpdateCustomerInput
  ) => Promise<CustomerMutationResult>
  deleteCustomer: (id: string) => Promise<CustomerMutationResult>
  markCustomersAsActive: (input: {
    customerIds: string[]
    validatedBy: string
  }) => Promise<CustomerMutationResult & { customers?: Customer[] }>
}

const CustomersContext = createContext<CustomersContextValue | null>(null)

function replaceCustomerInList(
  customers: Customer[],
  customer: Customer
): Customer[] {
  return customers.map((item) => (item.id === customer.id ? customer : item))
}

function sortCustomers(customers: Customer[]): Customer[] {
  return [...customers].sort((left, right) =>
    left.name.localeCompare(right.name, "es")
  )
}

export function CustomersProvider({ children }: { children: React.ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isCustomersReady, setIsCustomersReady] = useState(false)
  const [usesSupabase, setUsesSupabase] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadCustomersFromSupabase() {
      try {
        const client = createBrowserCustomersClient()
        const result = await listCustomers(client)

        if (cancelled) return

        if (result.error || result.data === null) {
          setCustomers([])
          setUsesSupabase(false)
          return
        }

        setCustomers(result.data)
        setUsesSupabase(true)
      } catch {
        if (!cancelled) {
          setCustomers([])
          setUsesSupabase(false)
        }
      } finally {
        if (!cancelled) {
          setIsCustomersReady(true)
        }
      }
    }

    void loadCustomersFromSupabase()

    return () => {
      cancelled = true
    }
  }, [])

  const getCustomer = useCallback(
    (id: string) => customers.find((customer) => customer.id === id),
    [customers]
  )

  const searchCustomers = useCallback(
    async (query: string, limit = 8) => {
      if (!usesSupabase) {
        const normalizedQuery = query.trim().toLowerCase()
        const filtered = customers.filter((customer) => {
          if (!normalizedQuery) return true
          return (
            customer.externalCustomerCode
              ?.toLowerCase()
              .includes(normalizedQuery) ||
            customer.dni?.toLowerCase().includes(normalizedQuery) ||
            customer.name.toLowerCase().includes(normalizedQuery) ||
            customer.phone?.includes(normalizedQuery) ||
            customer.address?.toLowerCase().includes(normalizedQuery) ||
            customer.locality?.toLowerCase().includes(normalizedQuery)
          )
        })
        return filtered.slice(0, limit)
      }

      try {
        const client = createBrowserCustomersClient()
        const result = await searchCustomersInSupabase(query, limit, client)
        return result.data ?? []
      } catch {
        return []
      }
    },
    [customers, usesSupabase]
  )

  const createCustomer = useCallback(
    async (input: NewCustomerInput): Promise<CustomerMutationResult> => {
      if (!usesSupabase) {
        return {
          success: false,
          message:
            "Supabase no está disponible. No se pudo registrar al cliente.",
        }
      }

      try {
        const client = createBrowserCustomersClient()
        const result = await createCustomerInSupabase(
          {
            name: input.name,
            externalCustomerCode: input.externalCustomerCode ?? null,
            dni: input.dni ?? null,
            phone: input.phone ?? null,
            email: input.email ?? null,
            address: input.address ?? null,
            locality: input.locality ?? null,
            technology: input.technology ?? null,
            status: input.status ?? "activo",
            validationStatus: input.validationStatus ?? "active",
          },
          client
        )

        if (result.data) {
          setCustomers((current) => sortCustomers([...current, result.data!]))
          return { success: true, customer: result.data }
        }

        return {
          success: false,
          message: result.error?.message ?? "No se pudo registrar al cliente.",
        }
      } catch {
        return {
          success: false,
          message: "No se pudo registrar al cliente.",
        }
      }
    },
    [usesSupabase]
  )

  const updateCustomer = useCallback(
    async (
      id: string,
      input: UpdateCustomerInput
    ): Promise<CustomerMutationResult> => {
      if (!usesSupabase) {
        return {
          success: false,
          message:
            "Supabase no está disponible. No se pudo actualizar al cliente.",
        }
      }

      try {
        const client = createBrowserCustomersClient()
        const result = await updateCustomerInSupabase(id, input, client)

        if (result.error) {
          return {
            success: false,
            message: result.error.message ?? "No se pudo actualizar al cliente.",
          }
        }

        if ("ok" in result && result.ok) {
          setCustomers((current) => current.filter((customer) => customer.id !== id))
          return { success: true }
        }

        if (result.data) {
          setCustomers((current) =>
            sortCustomers(replaceCustomerInList(current, result.data!))
          )
          return { success: true, customer: result.data }
        }

        return {
          success: false,
          message: "No se pudo actualizar al cliente.",
        }
      } catch {
        return {
          success: false,
          message: "No se pudo actualizar al cliente.",
        }
      }
    },
    [usesSupabase]
  )

  const deleteCustomer = useCallback(
    async (id: string): Promise<CustomerMutationResult> => {
      if (!usesSupabase) {
        return {
          success: false,
          message:
            "Supabase no está disponible. No se pudo eliminar al cliente.",
        }
      }

      try {
        const client = createBrowserCustomersClient()
        const result = await deleteCustomerInSupabase(id, client)

        if (result.error) {
          return {
            success: false,
            message: result.error.message ?? "No se pudo eliminar al cliente.",
          }
        }

        if ("ok" in result && result.ok) {
          setCustomers((current) => current.filter((customer) => customer.id !== id))
          return { success: true }
        }

        return {
          success: false,
          message: "No se pudo eliminar al cliente.",
        }
      } catch {
        return {
          success: false,
          message: "No se pudo eliminar al cliente.",
        }
      }
    },
    [usesSupabase]
  )

  const markCustomersAsActive = useCallback(
    async (input: {
      customerIds: string[]
      validatedBy: string
    }): Promise<CustomerMutationResult & { customers?: Customer[] }> => {
      if (!usesSupabase) {
        return {
          success: false,
          message:
            "Supabase no está disponible. No se pudo actualizar la validación.",
        }
      }

      try {
        const client = createBrowserCustomersClient()
        const result = await markCustomersAsActiveInSupabase(input, client)

        if (result.data) {
          setCustomers((current) => {
            const byId = new Map(result.data!.map((customer) => [customer.id, customer]))
            return sortCustomers(
              current.map((customer) => byId.get(customer.id) ?? customer)
            )
          })
          return { success: true, customers: result.data }
        }

        return {
          success: false,
          message: result.error?.message ?? "No se pudo marcar como activo.",
        }
      } catch {
        return {
          success: false,
          message: "No se pudo marcar como activo.",
        }
      }
    },
    [usesSupabase]
  )

  const value = useMemo(
    () => ({
      customers,
      isCustomersReady,
      usesSupabase,
      getCustomer,
      searchCustomers,
      createCustomer,
      updateCustomer,
      deleteCustomer,
      markCustomersAsActive,
    }),
    [
      customers,
      isCustomersReady,
      usesSupabase,
      getCustomer,
      searchCustomers,
      createCustomer,
      updateCustomer,
      deleteCustomer,
      markCustomersAsActive,
    ]
  )

  return (
    <CustomersContext.Provider value={value}>{children}</CustomersContext.Provider>
  )
}

export function useCustomers() {
  const context = useContext(CustomersContext)
  if (!context) {
    throw new Error("useCustomers must be used within CustomersProvider")
  }
  return context
}
