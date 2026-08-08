"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { useAuth } from "@/components/auth/auth-provider"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import { canWriteSubscriptions } from "@/lib/subscriptions/permissions"
import type { SubscriptionCustomerStatus } from "@/lib/subscriptions/statuses"
import {
  listSubscriptionCommissions,
  listSubscriptionCustomers,
  listSubscriptionSales,
  listSubscriptionServices,
  paySubscriptionCommission,
  registerSubscriptionPreAlta,
  updateSubscriptionCustomerStatus,
} from "@/lib/supabase/subscriptions.browser"
import type {
  CreateSubscriptionPreAltaInput,
  SubscriptionCommission,
  SubscriptionCustomer,
  SubscriptionSale,
  SubscriptionService,
} from "@/lib/types/subscriptions"

type MutationResult = {
  success: boolean
  message?: string
}

type SubscriptionsContextValue = {
  services: SubscriptionService[]
  customers: SubscriptionCustomer[]
  sales: SubscriptionSale[]
  commissions: SubscriptionCommission[]
  isReady: boolean
  canWrite: boolean
  bespokeTvService: SubscriptionService | null
  refresh: () => Promise<void>
  createPreAlta: (
    input: Omit<CreateSubscriptionPreAltaInput, "companyId">
  ) => Promise<MutationResult>
  transitionCustomer: (
    customerId: string,
    nextStatus: SubscriptionCustomerStatus
  ) => Promise<MutationResult>
  markCommissionPaid: (commissionId: string) => Promise<MutationResult>
}

const SubscriptionsContext =
  createContext<SubscriptionsContextValue | null>(null)

export function SubscriptionsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { sessionUser } = useAuth()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [services, setServices] = useState<SubscriptionService[]>([])
  const [customers, setCustomers] = useState<SubscriptionCustomer[]>([])
  const [sales, setSales] = useState<SubscriptionSale[]>([])
  const [commissions, setCommissions] = useState<SubscriptionCommission[]>(
    []
  )
  const [isReady, setIsReady] = useState(false)

  const canWrite = useMemo(
    () => canWriteSubscriptions(sessionUser?.systemRole),
    [sessionUser?.systemRole]
  )

  const bespokeTvService = useMemo(
    () =>
      services.find(
        (service) =>
          service.isActive &&
          service.name.trim().toLowerCase() === "bespoke tv"
      ) ??
      services.find((service) => service.isActive) ??
      null,
    [services]
  )

  const refresh = useCallback(async () => {
    if (!companyId) {
      setServices([])
      setCustomers([])
      setSales([])
      setCommissions([])
      setIsReady(true)
      return
    }

    const [servicesResult, customersResult, salesResult, commissionsResult] =
      await Promise.all([
        listSubscriptionServices(companyId),
        listSubscriptionCustomers(companyId),
        listSubscriptionSales(companyId),
        listSubscriptionCommissions(companyId),
      ])

    if (servicesResult.data) setServices(servicesResult.data)
    else if (servicesResult.error) {
      console.warn(
        "[Suscripciones] No se pudieron cargar servicios.",
        servicesResult.error.message
      )
      setServices([])
    }

    if (customersResult.data) setCustomers(customersResult.data)
    else if (customersResult.error) {
      console.warn(
        "[Suscripciones] No se pudieron cargar suscriptores.",
        customersResult.error.message
      )
      setCustomers([])
    }

    if (salesResult.data) setSales(salesResult.data)
    else setSales([])

    if (commissionsResult.data) setCommissions(commissionsResult.data)
    else setCommissions([])

    setIsReady(true)
  }, [companyId])

  useEffect(() => {
    if (!isAuthReady) return
    setIsReady(false)
    void refresh()
  }, [isAuthReady, refresh])

  const createPreAlta = useCallback(
    async (
      input: Omit<CreateSubscriptionPreAltaInput, "companyId">
    ): Promise<MutationResult> => {
      if (!companyId) {
        return { success: false, message: "No se pudo resolver la empresa." }
      }
      if (!canWrite) {
        return {
          success: false,
          message: "No tiene permiso para crear pre-altas.",
        }
      }

      const result = await registerSubscriptionPreAlta({
        ...input,
        companyId,
      })

      if (result.error || !result.data) {
        return {
          success: false,
          message: result.error?.message ?? "No se pudo crear la pre-alta.",
        }
      }

      await refresh()
      return { success: true }
    },
    [canWrite, companyId, refresh]
  )

  const transitionCustomer = useCallback(
    async (
      customerId: string,
      nextStatus: SubscriptionCustomerStatus
    ): Promise<MutationResult> => {
      if (!canWrite) {
        return {
          success: false,
          message: "No tiene permiso para cambiar el estado.",
        }
      }

      const result = await updateSubscriptionCustomerStatus(
        customerId,
        nextStatus
      )
      if (result.error || !result.data) {
        return {
          success: false,
          message:
            result.error?.message ?? "No se pudo actualizar el estado.",
        }
      }

      await refresh()
      return { success: true }
    },
    [canWrite, refresh]
  )

  const markCommissionPaid = useCallback(
    async (commissionId: string): Promise<MutationResult> => {
      if (!canWrite) {
        return {
          success: false,
          message: "No tiene permiso para marcar comisiones.",
        }
      }

      const result = await paySubscriptionCommission(commissionId)
      if (result.error || !result.data) {
        return {
          success: false,
          message:
            result.error?.message ?? "No se pudo marcar la comisión como pagada.",
        }
      }

      await refresh()
      return { success: true }
    },
    [canWrite, refresh]
  )

  const value = useMemo<SubscriptionsContextValue>(
    () => ({
      services,
      customers,
      sales,
      commissions,
      isReady,
      canWrite,
      bespokeTvService,
      refresh,
      createPreAlta,
      transitionCustomer,
      markCommissionPaid,
    }),
    [
      services,
      customers,
      sales,
      commissions,
      isReady,
      canWrite,
      bespokeTvService,
      refresh,
      createPreAlta,
      transitionCustomer,
      markCommissionPaid,
    ]
  )

  return (
    <SubscriptionsContext.Provider value={value}>
      {children}
    </SubscriptionsContext.Provider>
  )
}

export function useSubscriptions() {
  const context = useContext(SubscriptionsContext)
  if (!context) {
    throw new Error(
      "useSubscriptions debe usarse dentro de SubscriptionsProvider."
    )
  }
  return context
}
