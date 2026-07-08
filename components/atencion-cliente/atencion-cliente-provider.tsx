"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react"

import { useAuth } from "@/components/auth/auth-provider"
import { useDemoMode } from "@/components/demo/demo-mode-provider"
import {
  DEFAULT_ATENCION_PAGE_SIZE,
  type CustomerAtencionListQuery,
} from "@/lib/customer-atenciones/atencion-list"
import {
  blockDemoWrite,
  DEMO_WRITE_BLOCKED_MUTATION_RESULT,
} from "@/lib/demo/demo-write-block"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { searchCustomers as searchCustomersInSupabase } from "@/lib/supabase/customers.browser"
import {
  createBrowserCustomerAtencionesClient,
  createCustomerAtencion as createCustomerAtencionInSupabase,
  getCustomerAtencionById as loadCustomerAtencionById,
  listAtencionPage,
} from "@/lib/supabase/customer-atenciones.browser"
import type { Customer } from "@/lib/types/customers"
import type {
  CustomerAtencion,
  CustomerAtencionListPage,
  NewCustomerAtencionInput,
} from "@/lib/types/customer-atenciones"

type AtencionMutationResult = {
  success: boolean
  message?: string
  atencion?: CustomerAtencion
}

type AtencionClienteContextValue = {
  listPage: CustomerAtencionListPage | null
  isListLoading: boolean
  isReady: boolean
  listQuery: CustomerAtencionListQuery
  loadAtencionPage: (query: CustomerAtencionListQuery) => Promise<void>
  fetchAtencionById: (id: string) => Promise<CustomerAtencion | null>
  searchCustomers: (query: string, limit?: number) => Promise<Customer[]>
  createAtencion: (input: NewCustomerAtencionInput) => Promise<AtencionMutationResult>
}

const AtencionClienteContext = createContext<AtencionClienteContextValue | null>(
  null
)

export function AtencionClienteProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { sessionUser } = useAuth()
  const { isReadOnly, openRestrictedDialog } = useDemoMode()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [listPage, setListPage] = useState<CustomerAtencionListPage | null>(null)
  const [listQuery, setListQuery] = useState<CustomerAtencionListQuery>({
    page: 1,
    pageSize: DEFAULT_ATENCION_PAGE_SIZE,
    search: "",
  })
  const [isListLoading, setIsListLoading] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const atencionCacheRef = useRef<Map<string, CustomerAtencion>>(new Map())

  const loadAtencionPage = useCallback(
    async (query: CustomerAtencionListQuery) => {
      if (!isAuthReady || !companyId) {
        return
      }

      setIsListLoading(true)
      setListQuery(query)

      try {
        const result = await listAtencionPage(companyId, query)

        if (result.data) {
          setListPage(result.data)
        } else {
          setListPage({
            items: [],
            total: 0,
            page: query.page,
            pageSize: query.pageSize ?? DEFAULT_ATENCION_PAGE_SIZE,
          })
        }
      } finally {
        setIsListLoading(false)
        setIsReady(true)
      }
    },
    [companyId, isAuthReady]
  )

  const fetchAtencionById = useCallback(
    async (id: string) => {
      const cached = atencionCacheRef.current.get(id)
      if (cached) {
        return cached
      }

      if (!companyId) {
        return null
      }

      const result = await loadCustomerAtencionById(id, companyId)

      if (!result.data) {
        return null
      }

      atencionCacheRef.current.set(id, result.data)
      return result.data
    },
    [companyId]
  )

  const searchCustomers = useCallback(
    async (query: string, limit = 8) => {
      if (!companyId) {
        return []
      }

      const result = await searchCustomersInSupabase(companyId, query, limit)
      return result.data ?? []
    },
    [companyId]
  )

  const createAtencion = useCallback(
    async (input: NewCustomerAtencionInput): Promise<AtencionMutationResult> => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return DEMO_WRITE_BLOCKED_MUTATION_RESULT
      }

      if (!companyId) {
        return { success: false, message: "Empresa no disponible." }
      }

      const employeeId = sessionUser?.employeeId?.trim()
      if (!employeeId) {
        return {
          success: false,
          message: "No se pudo identificar al empleado que registra la atención.",
        }
      }

      const result = await createCustomerAtencionInSupabase({
        companyId,
        customerId: input.customerId,
        attendedByEmployeeId: employeeId,
        channel: input.channel,
        motivo: input.motivo,
        detail: input.detail,
        resolution: input.resolution,
      })

      if (result.error || !result.data) {
        return {
          success: false,
          message: result.error?.message ?? "No se pudo registrar la atención.",
        }
      }

      atencionCacheRef.current.set(result.data.id, result.data)
      await loadAtencionPage({
        ...listQuery,
        page: 1,
      })

      return { success: true, atencion: result.data }
    },
    [
      companyId,
      isReadOnly,
      listQuery,
      loadAtencionPage,
      openRestrictedDialog,
      sessionUser?.employeeId,
    ]
  )

  const value = useMemo(
    () => ({
      listPage,
      isListLoading,
      isReady,
      listQuery,
      loadAtencionPage,
      fetchAtencionById,
      searchCustomers,
      createAtencion,
    }),
    [
      createAtencion,
      fetchAtencionById,
      isListLoading,
      isReady,
      listPage,
      listQuery,
      loadAtencionPage,
      searchCustomers,
    ]
  )

  return (
    <AtencionClienteContext.Provider value={value}>
      {children}
    </AtencionClienteContext.Provider>
  )
}

export function useAtencionCliente() {
  const context = useContext(AtencionClienteContext)

  if (!context) {
    throw new Error("useAtencionCliente debe usarse dentro de AtencionClienteProvider.")
  }

  return context
}

export { createBrowserCustomerAtencionesClient }
