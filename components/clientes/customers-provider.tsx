"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import {
  isCustomerArchiveUpdate,
  recordCustomerArchiveAudit,
  recordCustomerCreateAudit,
  recordCustomerDeleteAudit,
  recordCustomerUpdateAudit,
  recordCustomerSyncFromWorkOrderAudit,
  recordCustomerValidateAudit,
} from "@/lib/audit/customers-audit"
import {
  DEFAULT_CUSTOMER_PAGE_SIZE,
  type CustomerListQuery,
} from "@/lib/customers/customer-list"
import type { CustomerOperationalSummary } from "@/lib/customers/customer-operational"
import {
  createBrowserCustomersClient,
  createCustomer as createCustomerInSupabase,
  deleteCustomer as deleteCustomerInSupabase,
  getCustomerDuplicateIndex,
  getCustomerById as loadCustomerById,
  getCustomerSummary,
  listCustomerPage,
  markCustomersAsActive as markCustomersAsActiveInSupabase,
  searchCustomers as searchCustomersInSupabase,
  updateCustomer as updateCustomerInSupabase,
} from "@/lib/supabase/customers.browser"
import type {
  Customer,
  CustomerListPage,
  CustomerListRow,
  NewCustomerInput,
  UpdateCustomerInput,
} from "@/lib/types/customers"

type CustomerMutationResult = {
  success: boolean
  message?: string
  customer?: Customer
}

type CustomersContextValue = {
  listPage: CustomerListPage | null
  isListLoading: boolean
  isSummaryLoading: boolean
  isCustomersReady: boolean
  usesSupabase: boolean
  operationalSummary: CustomerOperationalSummary
  listQuery: CustomerListQuery
  loadCustomerPage: (query: CustomerListQuery) => Promise<void>
  refreshOperationalSummary: () => Promise<void>
  getCustomer: (id: string) => Customer | undefined
  fetchCustomerById: (id: string) => Promise<Customer | null>
  getImportDuplicateIndex: () => Promise<
    Pick<Customer, "id" | "name" | "externalCustomerCode" | "dni">[]
  >
  searchCustomers: (query: string, limit?: number) => Promise<Customer[]>
  createCustomer: (input: NewCustomerInput) => Promise<CustomerMutationResult>
  updateCustomer: (
    id: string,
    input: UpdateCustomerInput,
    options?: {
      syncFromTask?: { id: string; code: string }
    }
  ) => Promise<CustomerMutationResult>
  deleteCustomer: (id: string) => Promise<CustomerMutationResult>
  removeCustomerLocally: (id: string) => void
  markCustomersAsActive: (input: {
    customerIds: string[]
    validatedBy: string
  }) => Promise<CustomerMutationResult & { customers?: Customer[] }>
}

const EMPTY_SUMMARY: CustomerOperationalSummary = {
  operativos: 0,
  activos: 0,
  revisar: 0,
}

const CustomersContext = createContext<CustomersContextValue | null>(null)

export function CustomersProvider({ children }: { children: React.ReactNode }) {
  const [listPage, setListPage] = useState<CustomerListPage | null>(null)
  const [operationalSummary, setOperationalSummary] =
    useState<CustomerOperationalSummary>(EMPTY_SUMMARY)
  const [listQuery, setListQuery] = useState<CustomerListQuery>({
    page: 1,
    pageSize: DEFAULT_CUSTOMER_PAGE_SIZE,
    search: "",
    quickFilter: "operativos",
  })
  const [isListLoading, setIsListLoading] = useState(true)
  const [isSummaryLoading, setIsSummaryLoading] = useState(true)
  const [isCustomersReady, setIsCustomersReady] = useState(false)
  const [usesSupabase, setUsesSupabase] = useState(false)
  const customerCacheRef = useRef<Map<string, Customer>>(new Map())
  const importIndexRef = useRef<
    Pick<Customer, "id" | "name" | "externalCustomerCode" | "dni">[] | null
  >(null)

  const refreshOperationalSummary = useCallback(async () => {
    setIsSummaryLoading(true)

    try {
      const client = createBrowserCustomersClient()
      const result = await getCustomerSummary(client)

      if (result.data) {
        setOperationalSummary(result.data)
        setUsesSupabase(true)
      } else {
        setOperationalSummary(EMPTY_SUMMARY)
        setUsesSupabase(false)
      }
    } catch {
      setOperationalSummary(EMPTY_SUMMARY)
      setUsesSupabase(false)
    } finally {
      setIsSummaryLoading(false)
    }
  }, [])

  const loadCustomerPage = useCallback(async (query: CustomerListQuery) => {
    setIsListLoading(true)
    setListQuery(query)

    try {
      const client = createBrowserCustomersClient()
      const result = await listCustomerPage(query, client)

      if (result.data) {
        setListPage(result.data)
        setUsesSupabase(true)
      } else {
        setListPage({
          items: [],
          total: 0,
          page: query.page,
          pageSize: query.pageSize ?? DEFAULT_CUSTOMER_PAGE_SIZE,
        })
        setUsesSupabase(false)
      }
    } catch {
      setListPage({
        items: [],
        total: 0,
        page: query.page,
        pageSize: query.pageSize ?? DEFAULT_CUSTOMER_PAGE_SIZE,
      })
      setUsesSupabase(false)
    } finally {
      setIsListLoading(false)
      setIsCustomersReady(true)
    }
  }, [])

  useEffect(() => {
    void refreshOperationalSummary()
  }, [refreshOperationalSummary])

  const getCustomer = useCallback((id: string) => {
    return customerCacheRef.current.get(id)
  }, [])

  const fetchCustomerById = useCallback(async (id: string) => {
    const cached = customerCacheRef.current.get(id)
    if (cached) {
      return cached
    }

    try {
      const client = createBrowserCustomersClient()
      const result = await loadCustomerById(id, client)

      if (result.data) {
        customerCacheRef.current.set(id, result.data)
        return result.data
      }
    } catch {
      return null
    }

    return null
  }, [])

  const getImportDuplicateIndex = useCallback(async () => {
    if (importIndexRef.current) {
      return importIndexRef.current
    }

    const client = createBrowserCustomersClient()
    const result = await getCustomerDuplicateIndex(client)
    importIndexRef.current = result.data ?? []
    return importIndexRef.current
  }, [])

  const searchCustomers = useCallback(
    async (query: string, limit = 8) => {
      if (!usesSupabase) {
        return []
      }

      try {
        const client = createBrowserCustomersClient()
        const result = await searchCustomersInSupabase(query, limit, client)
        const customers = result.data ?? []

        for (const customer of customers) {
          customerCacheRef.current.set(customer.id, customer)
        }

        return customers
      } catch {
        return []
      }
    },
    [usesSupabase]
  )

  const invalidateImportIndex = useCallback(() => {
    importIndexRef.current = null
  }, [])

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
          customerCacheRef.current.set(result.data.id, result.data)
          invalidateImportIndex()
          await Promise.all([
            loadCustomerPage(listQuery),
            refreshOperationalSummary(),
          ])
          recordCustomerCreateAudit(result.data)
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
    [
      usesSupabase,
      loadCustomerPage,
      listQuery,
      refreshOperationalSummary,
      invalidateImportIndex,
    ]
  )

  const updateCustomer = useCallback(
    async (
      id: string,
      input: UpdateCustomerInput,
      options?: {
        syncFromTask?: { id: string; code: string }
      }
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
        const existing = customerCacheRef.current.get(id)
        const result = await updateCustomerInSupabase(id, input, client)

        if (result.error) {
          return {
            success: false,
            message: result.error.message ?? "No se pudo actualizar al cliente.",
          }
        }

        if ("ok" in result && result.ok) {
          if (existing && isCustomerArchiveUpdate(input)) {
            recordCustomerArchiveAudit(existing)
          }
          customerCacheRef.current.delete(id)
          invalidateImportIndex()
          await Promise.all([
            loadCustomerPage(listQuery),
            refreshOperationalSummary(),
          ])
          return { success: true }
        }

        if (result.data) {
          customerCacheRef.current.set(result.data.id, result.data)
          if (isCustomerArchiveUpdate(input)) {
            recordCustomerArchiveAudit(result.data)
          } else if (existing) {
            if (options?.syncFromTask) {
              recordCustomerSyncFromWorkOrderAudit(
                existing,
                input,
                options.syncFromTask
              )
            } else {
              recordCustomerUpdateAudit(existing, input)
            }
          }
          invalidateImportIndex()
          await Promise.all([
            loadCustomerPage(listQuery),
            refreshOperationalSummary(),
          ])
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
    [
      usesSupabase,
      loadCustomerPage,
      listQuery,
      refreshOperationalSummary,
      invalidateImportIndex,
    ]
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
        const existing = customerCacheRef.current.get(id)
        const result = await deleteCustomerInSupabase(id, client)

        if (result.error) {
          return {
            success: false,
            message: result.error.message ?? "No se pudo eliminar al cliente.",
          }
        }

        if ("ok" in result && result.ok) {
          if (existing) {
            recordCustomerDeleteAudit(existing)
          }
          customerCacheRef.current.delete(id)
          invalidateImportIndex()
          await Promise.all([
            loadCustomerPage(listQuery),
            refreshOperationalSummary(),
          ])
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
    [
      usesSupabase,
      loadCustomerPage,
      listQuery,
      refreshOperationalSummary,
      invalidateImportIndex,
    ]
  )

  const removeCustomerLocally = useCallback(
    (id: string) => {
      customerCacheRef.current.delete(id)
      setListPage((current) =>
        current
          ? {
              ...current,
              items: current.items.filter((item) => item.id !== id),
              total: Math.max(0, current.total - 1),
            }
          : current
      )
      void refreshOperationalSummary()
    },
    [refreshOperationalSummary]
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
          for (const customer of result.data) {
            customerCacheRef.current.set(customer.id, customer)
          }

          await Promise.all([
            loadCustomerPage(listQuery),
            refreshOperationalSummary(),
          ])

          for (const customer of result.data) {
            const previous = customerCacheRef.current.get(customer.id)
            recordCustomerValidateAudit(previous ?? customer, input.validatedBy)
          }

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
    [usesSupabase, loadCustomerPage, listQuery, refreshOperationalSummary]
  )

  const value = useMemo(
    () => ({
      listPage,
      isListLoading,
      isSummaryLoading,
      isCustomersReady,
      usesSupabase,
      operationalSummary,
      listQuery,
      loadCustomerPage,
      refreshOperationalSummary,
      getCustomer,
      fetchCustomerById,
      getImportDuplicateIndex,
      searchCustomers,
      createCustomer,
      updateCustomer,
      deleteCustomer,
      removeCustomerLocally,
      markCustomersAsActive,
    }),
    [
      listPage,
      isListLoading,
      isSummaryLoading,
      isCustomersReady,
      usesSupabase,
      operationalSummary,
      listQuery,
      loadCustomerPage,
      refreshOperationalSummary,
      getCustomer,
      fetchCustomerById,
      getImportDuplicateIndex,
      searchCustomers,
      createCustomer,
      updateCustomer,
      deleteCustomer,
      removeCustomerLocally,
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

export function useCustomersOptional() {
  return useContext(CustomersContext)
}
