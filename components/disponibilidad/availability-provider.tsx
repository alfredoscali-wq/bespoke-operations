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
  createBrowserEmployeeAvailabilityClient,
  createEmployeeAvailability,
  getEmployeeAvailabilities,
  softDeleteEmployeeAvailability,
  updateEmployeeAvailability,
} from "@/lib/availability/employee-availability.service"
import type {
  CreateEmployeeAvailabilityInput,
  EmployeeAvailability,
  UpdateEmployeeAvailabilityInput,
} from "@/lib/types/availability"

type AvailabilityMutationResult = {
  success: boolean
  message?: string
  record?: EmployeeAvailability
}

type AvailabilityContextValue = {
  records: EmployeeAvailability[]
  isAvailabilityReady: boolean
  usesSupabase: boolean
  getRecord: (id: string) => EmployeeAvailability | undefined
  addRecord: (
    input: CreateEmployeeAvailabilityInput
  ) => Promise<AvailabilityMutationResult>
  editRecord: (
    id: string,
    input: UpdateEmployeeAvailabilityInput
  ) => Promise<AvailabilityMutationResult>
  removeRecord: (id: string) => Promise<AvailabilityMutationResult>
}

const AvailabilityContext = createContext<AvailabilityContextValue | null>(null)

function sortRecords(records: EmployeeAvailability[]): EmployeeAvailability[] {
  return [...records].sort((a, b) => b.startDate.localeCompare(a.startDate))
}

export function AvailabilityProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [records, setRecords] = useState<EmployeeAvailability[]>([])
  const [isAvailabilityReady, setIsAvailabilityReady] = useState(false)
  const [usesSupabase, setUsesSupabase] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadRecords() {
      try {
        const client = createBrowserEmployeeAvailabilityClient()
        const result = await getEmployeeAvailabilities(client)

        if (cancelled) return

        if (result.error || result.data === null) {
          setRecords([])
          setUsesSupabase(false)
          return
        }

        setRecords(sortRecords(result.data))
        setUsesSupabase(true)
      } catch {
        if (!cancelled) {
          setRecords([])
          setUsesSupabase(false)
        }
      } finally {
        if (!cancelled) {
          setIsAvailabilityReady(true)
        }
      }
    }

    void loadRecords()

    return () => {
      cancelled = true
    }
  }, [])

  const getRecord = useCallback(
    (id: string) => records.find((record) => record.id === id),
    [records]
  )

  const addRecord = useCallback(
    async (input: CreateEmployeeAvailabilityInput) => {
      if (!usesSupabase) {
        return {
          success: false,
          message:
            "Supabase no está disponible. No se pudo registrar la novedad.",
        }
      }

      try {
        const client = createBrowserEmployeeAvailabilityClient()
        const result = await createEmployeeAvailability(input, client)

        if (result.error || !result.data) {
          return {
            success: false,
            message:
              result.error?.message ??
              "No se pudo registrar la novedad.",
          }
        }

        setRecords((current) => sortRecords([result.data!, ...current]))
        return { success: true, record: result.data }
      } catch {
        return {
          success: false,
          message: "No se pudo registrar la novedad.",
        }
      }
    },
    [usesSupabase]
  )

  const editRecord = useCallback(
    async (id: string, input: UpdateEmployeeAvailabilityInput) => {
      if (!usesSupabase) {
        return {
          success: false,
          message:
            "Supabase no está disponible. No se pudo actualizar la novedad.",
        }
      }

      try {
        const client = createBrowserEmployeeAvailabilityClient()
        const result = await updateEmployeeAvailability(id, input, client)

        if (result.error || !result.data) {
          return {
            success: false,
            message:
              result.error?.message ??
              "No se pudo actualizar la novedad.",
          }
        }

        setRecords((current) =>
          sortRecords(
            current.map((record) =>
              record.id === id ? result.data! : record
            )
          )
        )
        return { success: true, record: result.data }
      } catch {
        return {
          success: false,
          message: "No se pudo actualizar la novedad.",
        }
      }
    },
    [usesSupabase]
  )

  const removeRecord = useCallback(
    async (id: string) => {
      if (!usesSupabase) {
        return {
          success: false,
          message:
            "Supabase no está disponible. No se pudo eliminar la novedad.",
        }
      }

      try {
        const client = createBrowserEmployeeAvailabilityClient()
        const result = await softDeleteEmployeeAvailability(id, client)

        if (result.error) {
          return {
            success: false,
            message:
              result.error.message ??
              "No se pudo eliminar la novedad.",
          }
        }

        setRecords((current) => current.filter((record) => record.id !== id))
        return { success: true }
      } catch {
        return {
          success: false,
          message: "No se pudo eliminar la novedad.",
        }
      }
    },
    [usesSupabase]
  )

  const value = useMemo(
    () => ({
      records,
      isAvailabilityReady,
      usesSupabase,
      getRecord,
      addRecord,
      editRecord,
      removeRecord,
    }),
    [
      records,
      isAvailabilityReady,
      usesSupabase,
      getRecord,
      addRecord,
      editRecord,
      removeRecord,
    ]
  )

  if (!isAvailabilityReady) {
    return null
  }

  return (
    <AvailabilityContext.Provider value={value}>
      {children}
    </AvailabilityContext.Provider>
  )
}

export function useAvailability() {
  const context = useContext(AvailabilityContext)
  if (!context) {
    throw new Error("useAvailability must be used within AvailabilityProvider")
  }
  return context
}
