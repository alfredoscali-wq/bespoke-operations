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
import {
  emitTreasuryMovementCancelled,
  emitTreasuryMovementCreated,
  emitTreasuryMovementDeleted,
  emitTreasuryMovementUpdated,
  emitTreasuryReceiptUploaded,
} from "@/lib/activity/adapters/treasury-activity"
import { resolveOperationalEventActor } from "@/lib/tasks/operational-event-actor"
import { buildOtRendidaOperationalEvent } from "@/lib/tasks/operational-motivos"
import { recordTaskOperationalEvent } from "@/lib/supabase/operational-control.browser"
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  annulTreasuryMovement,
  createTreasuryMovement,
  listTreasuryMovements,
  permanentlyDeleteTreasuryMovement,
  updateTreasuryMovement,
} from "@/lib/supabase/treasury.browser"
import {
  confirmOtCashRendition,
  listTreasuryOtRenditions,
} from "@/lib/supabase/treasury-ot-renditions.browser"
import { createClient } from "@/lib/supabase/client"
import {
  canHardDeleteTreasury,
  canWriteTreasury,
} from "@/lib/tesoreria/permissions"
import {
  resolveTreasuryHistoryFilterSelection,
  TREASURY_HISTORY_FILTER_NONE,
  type TreasuryHistoryFilter,
} from "@/lib/tesoreria/history-filter"
import {
  buildTreasuryReceiptStoragePath,
  TREASURY_RECEIPT_MAX_BYTES,
  TREASURY_RECEIPT_MIME_TYPES,
  TREASURY_RECEIPTS_BUCKET,
} from "@/lib/tesoreria/receipt-storage"
import type {
  CreateTreasuryMovementInput,
  TreasuryHistoryRange,
  TreasuryMovement,
  UpdateTreasuryMovementInput,
} from "@/lib/types/tesoreria"
import type {
  ConfirmOtRenditionInput,
  TreasuryOtRendition,
} from "@/lib/types/treasury-ot-renditions"

type MutationResult = {
  success: boolean
  message?: string
  movement?: TreasuryMovement
}

type RenditionMutationResult = {
  success: boolean
  message?: string
  rendition?: TreasuryOtRendition
  movementId?: string
}

type TreasuryContextValue = {
  movements: TreasuryMovement[]
  otRenditions: TreasuryOtRendition[]
  isReady: boolean
  canWrite: boolean
  canHardDelete: boolean
  historyRange: TreasuryHistoryRange
  setHistoryRange: (range: TreasuryHistoryRange) => void
  historyFilter: TreasuryHistoryFilter
  toggleHistoryFilter: (filter: TreasuryHistoryFilter) => void
  selectHistoryFilter: (filter: TreasuryHistoryFilter) => void
  clearHistoryFilter: () => void
  refresh: () => Promise<void>
  registerMovement: (
    input: Omit<CreateTreasuryMovementInput, "companyId" | "registeredBy">,
    receiptFile?: File | null
  ) => Promise<MutationResult>
  editMovement: (
    id: string,
    input: UpdateTreasuryMovementInput
  ) => Promise<MutationResult>
  cancelMovement: (id: string) => Promise<MutationResult>
  hardDeleteMovement: (id: string) => Promise<MutationResult>
  confirmOtRendition: (
    renditionId: string,
    input: ConfirmOtRenditionInput
  ) => Promise<RenditionMutationResult>
}

const TreasuryContext = createContext<TreasuryContextValue | null>(null)

export function TreasuryProvider({ children }: { children: React.ReactNode }) {
  const { sessionUser } = useAuth()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [movements, setMovements] = useState<TreasuryMovement[]>([])
  const [otRenditions, setOtRenditions] = useState<TreasuryOtRendition[]>([])
  const [isReady, setIsReady] = useState(false)
  const [historyRange, setHistoryRange] =
    useState<TreasuryHistoryRange>("today")
  const [historyFilter, setHistoryFilter] = useState<TreasuryHistoryFilter>(
    TREASURY_HISTORY_FILTER_NONE
  )

  const canWrite = useMemo(
    () => canWriteTreasury(sessionUser?.systemRole),
    [sessionUser?.systemRole]
  )

  const canHardDelete = useMemo(
    () => canHardDeleteTreasury(sessionUser?.systemRole),
    [sessionUser?.systemRole]
  )

  const refresh = useCallback(async () => {
    if (!companyId) {
      setMovements([])
      setOtRenditions([])
      setIsReady(true)
      return
    }

    const [movementsResult, renditionsResult] = await Promise.all([
      listTreasuryMovements(companyId),
      listTreasuryOtRenditions(companyId),
    ])

    if (movementsResult.data) {
      setMovements(movementsResult.data)
    }
    if (renditionsResult.data) {
      setOtRenditions(renditionsResult.data)
    } else if (renditionsResult.error) {
      // Table may not exist until migration is applied — keep empty.
      console.warn(
        "[Tesorería] No se pudieron cargar pendientes de rendición.",
        renditionsResult.error.message
      )
      setOtRenditions([])
    }
    setIsReady(true)
  }, [companyId])

  useEffect(() => {
    if (!isAuthReady) return
    setIsReady(false)
    void refresh()
  }, [isAuthReady, refresh])

  const uploadReceipt = useCallback(
    async (movementId: string, file: File): Promise<string | null> => {
      if (!companyId) return null
      if (file.size > TREASURY_RECEIPT_MAX_BYTES) {
        throw new Error("El comprobante supera el tamaño máximo (10 MB).")
      }
      if (
        !(TREASURY_RECEIPT_MIME_TYPES as readonly string[]).includes(file.type)
      ) {
        throw new Error("Formato de comprobante no permitido.")
      }

      const path = buildTreasuryReceiptStoragePath({
        companyId,
        movementId,
        fileName: file.name,
      })
      const client = createClient()
      const { error } = await client.storage
        .from(TREASURY_RECEIPTS_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type })

      if (error) {
        throw new Error(error.message)
      }

      return path
    },
    [companyId]
  )

  const registerMovement = useCallback(
    async (
      input: Omit<CreateTreasuryMovementInput, "companyId" | "registeredBy">,
      receiptFile?: File | null
    ): Promise<MutationResult> => {
      if (!companyId) {
        return { success: false, message: "No se pudo resolver la empresa." }
      }
      if (!canWrite) {
        return { success: false, message: "No tiene permiso para registrar movimientos." }
      }

      const createResult = await createTreasuryMovement({
        ...input,
        companyId,
        registeredBy: sessionUser?.employeeId ?? null,
      })

      if (createResult.error || !createResult.data) {
        return {
          success: false,
          message: createResult.error?.message ?? "No se pudo registrar el movimiento.",
        }
      }

      let movement = createResult.data
      emitTreasuryMovementCreated(movement)

      if (receiptFile) {
        try {
          const receiptUrl = await uploadReceipt(movement.id, receiptFile)
          if (receiptUrl) {
            const patched = await updateTreasuryMovement(movement.id, {
              receiptUrl,
            })
            if (patched.data) {
              movement = patched.data
              emitTreasuryReceiptUploaded(movement)
            }
          }
        } catch (error) {
          return {
            success: true,
            movement,
            message:
              error instanceof Error
                ? `Movimiento guardado, pero el comprobante falló: ${error.message}`
                : "Movimiento guardado, pero el comprobante falló.",
          }
        }
      }

      setMovements((current) => [movement, ...current])
      return { success: true, movement }
    },
    [canWrite, companyId, sessionUser?.employeeId, uploadReceipt]
  )

  const editMovement = useCallback(
    async (
      id: string,
      input: UpdateTreasuryMovementInput
    ): Promise<MutationResult> => {
      if (!canWrite) {
        return { success: false, message: "No tiene permiso para editar movimientos." }
      }

      const result = await updateTreasuryMovement(id, input)
      if (result.error || !result.data) {
        return {
          success: false,
          message: result.error?.message ?? "No se pudo actualizar el movimiento.",
        }
      }

      emitTreasuryMovementUpdated(result.data)
      setMovements((current) =>
        current.map((item) => (item.id === id ? result.data! : item))
      )
      return { success: true, movement: result.data }
    },
    [canWrite]
  )

  const cancelMovement = useCallback(
    async (id: string): Promise<MutationResult> => {
      if (!canWrite) {
        return { success: false, message: "No tiene permiso para anular movimientos." }
      }

      const result = await annulTreasuryMovement(id)
      if (result.error || !result.data) {
        return {
          success: false,
          message: result.error?.message ?? "No se pudo anular el movimiento.",
        }
      }

      emitTreasuryMovementCancelled(result.data)
      setMovements((current) =>
        current.map((item) => (item.id === id ? result.data! : item))
      )
      return { success: true, movement: result.data }
    },
    [canWrite]
  )

  const hardDeleteMovement = useCallback(
    async (id: string): Promise<MutationResult> => {
      if (!canHardDelete) {
        return {
          success: false,
          message: "Solo un Administrador puede eliminar definitivamente movimientos.",
        }
      }

      const result = await permanentlyDeleteTreasuryMovement(id)
      if (result.error || !result.data) {
        return {
          success: false,
          message:
            result.error?.message ?? "No se pudo eliminar el movimiento.",
        }
      }

      emitTreasuryMovementDeleted(result.data)
      setMovements((current) => current.filter((item) => item.id !== id))
      return { success: true, movement: result.data }
    },
    [canHardDelete]
  )

  const toggleHistoryFilter = useCallback((next: TreasuryHistoryFilter) => {
    setHistoryFilter((current) =>
      resolveTreasuryHistoryFilterSelection(current, next, "toggle")
    )
  }, [])

  const selectHistoryFilter = useCallback((next: TreasuryHistoryFilter) => {
    setHistoryFilter(
      resolveTreasuryHistoryFilterSelection(
        TREASURY_HISTORY_FILTER_NONE,
        next,
        "replace"
      )
    )
  }, [])

  const clearHistoryFilter = useCallback(() => {
    setHistoryFilter(TREASURY_HISTORY_FILTER_NONE)
  }, [])

  const confirmOtRendition = useCallback(
    async (
      renditionId: string,
      input: ConfirmOtRenditionInput
    ): Promise<RenditionMutationResult> => {
      if (!companyId) {
        return { success: false, message: "No se pudo resolver la empresa." }
      }
      if (!canWrite) {
        return {
          success: false,
          message: "No tiene permiso para registrar rendiciones.",
        }
      }

      const current = otRenditions.find((item) => item.id === renditionId)
      if (!current) {
        return { success: false, message: "Rendición no encontrada." }
      }

      const confirmedByName =
        sessionUser?.displayName?.trim() ||
        sessionUser?.email?.trim() ||
        "Usuario"

      const result = await confirmOtCashRendition(current, {
        ...input,
        companyId,
        confirmedBy: sessionUser?.employeeId ?? null,
        confirmedByName,
      })

      if (result.error || !result.data) {
        return {
          success: false,
          message:
            result.error?.message ?? "No se pudo confirmar la rendición.",
        }
      }

      const { rendition, movementId } = result.data
      setOtRenditions((items) =>
        items.map((item) => (item.id === rendition.id ? rendition : item))
      )
      void refresh()

      const actor = resolveOperationalEventActor(
        sessionUser,
        confirmedByName
      )
      void recordTaskOperationalEvent(
        buildOtRendidaOperationalEvent({
          companyId,
          taskId: rendition.taskId,
          taskCode: rendition.taskCode,
          customerName: rendition.customerName,
          crewName: rendition.crewName,
          amount: rendition.amount,
          deliveredBy: rendition.deliveredBy,
          paymentMethodExpected: rendition.paymentMethodExpected,
          paymentMethodReceived: rendition.paymentMethodReceived,
          actor,
        })
      )

      return {
        success: true,
        rendition,
        movementId,
        message: "Rendición confirmada. Se registró el ingreso en Tesorería.",
      }
    },
    [
      canWrite,
      companyId,
      otRenditions,
      refresh,
      sessionUser,
    ]
  )

  const value = useMemo(
    () => ({
      movements,
      otRenditions,
      isReady,
      canWrite,
      canHardDelete,
      historyRange,
      setHistoryRange,
      historyFilter,
      toggleHistoryFilter,
      selectHistoryFilter,
      clearHistoryFilter,
      refresh,
      registerMovement,
      editMovement,
      cancelMovement,
      hardDeleteMovement,
      confirmOtRendition,
    }),
    [
      movements,
      otRenditions,
      isReady,
      canWrite,
      canHardDelete,
      historyRange,
      historyFilter,
      toggleHistoryFilter,
      selectHistoryFilter,
      clearHistoryFilter,
      refresh,
      registerMovement,
      editMovement,
      cancelMovement,
      hardDeleteMovement,
      confirmOtRendition,
    ]
  )

  return (
    <TreasuryContext.Provider value={value}>{children}</TreasuryContext.Provider>
  )
}

export function useTreasury() {
  const context = useContext(TreasuryContext)
  if (!context) {
    throw new Error("useTreasury debe usarse dentro de TreasuryProvider.")
  }
  return context
}
