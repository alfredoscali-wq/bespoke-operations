"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { useDemoMode } from "@/components/demo/demo-mode-provider"
import {
  blockDemoWrite,
  DEMO_WRITE_BLOCKED_MUTATION_RESULT,
} from "@/lib/demo/demo-write-block"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  createBrowserContractorsClient,
  createContractor,
  deleteContractor,
  listContractors,
  updateContractor,
} from "@/lib/supabase/contractors.browser"
import type {
  Contractor,
  NewContractorInput,
  UpdateContractorInput,
} from "@/lib/types/contractors"

type ContractorMutationResult = {
  success: boolean
  message?: string
}

type ContractorsContextValue = {
  contractors: Contractor[]
  isContractorsReady: boolean
  getContractor: (id: string) => Contractor | undefined
  addContractor: (
    input: NewContractorInput
  ) => Promise<ContractorMutationResult & { contractor?: Contractor }>
  editContractor: (
    id: string,
    input: UpdateContractorInput
  ) => Promise<ContractorMutationResult & { contractor?: Contractor }>
  removeContractor: (id: string) => Promise<ContractorMutationResult>
  forgetContractor: (id: string) => void
}

const ContractorsContext = createContext<ContractorsContextValue | null>(null)

function replaceContractorInList(
  contractors: Contractor[],
  contractor: Contractor
): Contractor[] {
  return contractors.map((item) =>
    item.id === contractor.id ? contractor : item
  )
}

export function ContractorsProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { isReadOnly, openRestrictedDialog } = useDemoMode()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [isContractorsReady, setIsContractorsReady] = useState(false)

  useEffect(() => {
    if (!isAuthReady) return

    let cancelled = false

    async function load() {
      try {
        const client = createBrowserContractorsClient()
        const result = await listContractors(companyId, client)
        if (cancelled) return

        if (result.error || !result.data) {
          setContractors([])
          return
        }

        setContractors(result.data)
      } catch {
        if (!cancelled) setContractors([])
      } finally {
        if (!cancelled) setIsContractorsReady(true)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [companyId, isAuthReady])

  const getContractor = useCallback(
    (id: string) => contractors.find((item) => item.id === id),
    [contractors]
  )

  const addContractor = useCallback(
    async (input: NewContractorInput) => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return DEMO_WRITE_BLOCKED_MUTATION_RESULT
      }

      try {
        const client = createBrowserContractorsClient()
        const result = await createContractor(
          {
            companyId,
            legalName: input.legalName,
            tradeName: input.tradeName,
            taxId: input.taxId,
            responsibleName: input.responsibleName,
            phone: input.phone,
            email: input.email,
            status: input.status,
            notes: input.notes,
          },
          client
        )

        if (result.data) {
          setContractors((current) =>
            [...current, result.data!].sort((a, b) =>
              a.legalName.localeCompare(b.legalName, "es")
            )
          )
          return { success: true, contractor: result.data }
        }

        return {
          success: false,
          message: result.error?.message ?? "No se pudo crear el contratista.",
        }
      } catch {
        return {
          success: false,
          message: "No se pudo crear el contratista.",
        }
      }
    },
    [companyId, isReadOnly, openRestrictedDialog]
  )

  const editContractor = useCallback(
    async (id: string, input: UpdateContractorInput) => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return DEMO_WRITE_BLOCKED_MUTATION_RESULT
      }

      try {
        const client = createBrowserContractorsClient()
        const result = await updateContractor(id, input, client)

        if (result.data) {
          setContractors((current) =>
            replaceContractorInList(current, result.data!)
          )
          return { success: true, contractor: result.data }
        }

        return {
          success: false,
          message:
            result.error?.message ?? "No se pudo actualizar el contratista.",
        }
      } catch {
        return {
          success: false,
          message: "No se pudo actualizar el contratista.",
        }
      }
    },
    [isReadOnly, openRestrictedDialog]
  )

  const removeContractor = useCallback(
    async (id: string) => {
      if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
        return DEMO_WRITE_BLOCKED_MUTATION_RESULT
      }

      try {
        const client = createBrowserContractorsClient()
        const result = await deleteContractor(id, client)

        if (result.data) {
          setContractors((current) =>
            current.filter((item) => item.id !== id)
          )
          return { success: true }
        }

        return {
          success: false,
          message:
            result.error?.message ?? "No se pudo eliminar el contratista.",
        }
      } catch {
        return {
          success: false,
          message: "No se pudo eliminar el contratista.",
        }
      }
    },
    [isReadOnly, openRestrictedDialog]
  )

  const forgetContractor = useCallback((id: string) => {
    setContractors((current) => current.filter((item) => item.id !== id))
  }, [])

  const value = useMemo(
    () => ({
      contractors,
      isContractorsReady,
      getContractor,
      addContractor,
      editContractor,
      removeContractor,
      forgetContractor,
    }),
    [
      contractors,
      isContractorsReady,
      getContractor,
      addContractor,
      editContractor,
      removeContractor,
      forgetContractor,
    ]
  )

  return (
    <ContractorsContext.Provider value={value}>
      {isContractorsReady ? children : null}
    </ContractorsContext.Provider>
  )
}

export function useContractors() {
  const context = useContext(ContractorsContext)
  if (!context) {
    throw new Error("useContractors must be used within ContractorsProvider")
  }
  return context
}
