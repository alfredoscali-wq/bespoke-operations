"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import type { DuplicateMatch } from "@/lib/customers/commercial-migration/types"
import type {
  EnrichedMigrationCustomer,
  MigrationReviewAction,
  MigrationReviewState,
} from "@/lib/customers/commercial-migration/review-types"
import {
  countMigrationReviewKpis,
  enrichMigrationCustomers,
} from "@/lib/customers/commercial-migration/review-utils"

type MigrationReviewPayload = {
  generatedAt: string
  sourceDump: string
  reviewStateUpdatedAt: string
  duplicateGroups: DuplicateMatch[]
  records: EnrichedMigrationCustomer[]
}

type MigrationReviewContextValue = {
  isReady: boolean
  error: string | null
  generatedAt: string | null
  sourceDump: string | null
  duplicateGroups: DuplicateMatch[]
  records: EnrichedMigrationCustomer[]
  kpis: ReturnType<typeof countMigrationReviewKpis>
  applyReviewAction: (
    legacyId: number,
    action: MigrationReviewAction
  ) => Promise<void>
  reload: () => Promise<void>
}

const MigrationReviewContext =
  createContext<MigrationReviewContextValue | null>(null)

export function MigrationReviewProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<MigrationReviewPayload | null>(null)

  const load = useCallback(async () => {
    setIsReady(false)
    setError(null)

    try {
      const response = await fetch("/api/clientes/migracion")
      const data = (await response.json()) as MigrationReviewPayload & {
        error?: string
      }

      if (!response.ok) {
        throw new Error(data.error ?? "No fue posible cargar el dataset")
      }

      setPayload(data)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No fue posible cargar el dataset"
      )
      setPayload(null)
    } finally {
      setIsReady(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const applyReviewAction = useCallback(
    async (legacyId: number, action: MigrationReviewAction) => {
      const response = await fetch("/api/clientes/migracion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ legacyId, action }),
      })

      const data = (await response.json()) as {
        ok?: boolean
        reviewState?: MigrationReviewState
        error?: string
      }

      if (!response.ok || !data.reviewState) {
        throw new Error(data.error ?? "No fue posible guardar la decisión")
      }

      setPayload((current) => {
        if (!current) return current

        const baseRecords = current.records.map(
          ({ reviewAction, reviewedAt, effectiveBucket, ...rest }) => rest
        )

        return {
          ...current,
          reviewStateUpdatedAt: data.reviewState!.updatedAt,
          records: enrichMigrationCustomers(
            baseRecords,
            data.reviewState!.decisions
          ),
        }
      })
    },
    []
  )

  const records = payload?.records ?? []
  const kpis = useMemo(() => countMigrationReviewKpis(records), [records])

  const value = useMemo(
    () => ({
      isReady,
      error,
      generatedAt: payload?.generatedAt ?? null,
      sourceDump: payload?.sourceDump ?? null,
      duplicateGroups: payload?.duplicateGroups ?? [],
      records,
      kpis,
      applyReviewAction,
      reload: load,
    }),
    [
      isReady,
      error,
      payload,
      records,
      kpis,
      applyReviewAction,
      load,
    ]
  )

  return (
    <MigrationReviewContext.Provider value={value}>
      {children}
    </MigrationReviewContext.Provider>
  )
}

export function useMigrationReview() {
  const context = useContext(MigrationReviewContext)

  if (!context) {
    throw new Error(
      "useMigrationReview must be used within MigrationReviewProvider"
    )
  }

  return context
}
