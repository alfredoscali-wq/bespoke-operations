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
import { useTenantCompanyId } from "@/lib/operations/use-tenant-company-id"
import {
  annulTreasuryMovement,
  createTreasuryMovement,
  listTreasuryMovements,
  permanentlyDeleteTreasuryMovement,
  updateTreasuryMovement,
} from "@/lib/supabase/treasury.browser"
import { createClient } from "@/lib/supabase/client"
import {
  canHardDeleteTreasury,
  canWriteTreasury,
} from "@/lib/tesoreria/permissions"
import {
  buildTreasuryReceiptStoragePath,
  TREASURY_RECEIPT_MAX_BYTES,
  TREASURY_RECEIPT_MIME_TYPES,
  TREASURY_RECEIPTS_BUCKET,
} from "@/lib/tesoreria/receipt-storage"
import type {
  CreateTreasuryMovementInput,
  TreasuryMovement,
  UpdateTreasuryMovementInput,
} from "@/lib/types/tesoreria"

type MutationResult = {
  success: boolean
  message?: string
  movement?: TreasuryMovement
}

type TreasuryContextValue = {
  movements: TreasuryMovement[]
  isReady: boolean
  canWrite: boolean
  canHardDelete: boolean
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
}

const TreasuryContext = createContext<TreasuryContextValue | null>(null)

export function TreasuryProvider({ children }: { children: React.ReactNode }) {
  const { sessionUser } = useAuth()
  const { companyId, isAuthReady } = useTenantCompanyId()
  const [movements, setMovements] = useState<TreasuryMovement[]>([])
  const [isReady, setIsReady] = useState(false)

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
      setIsReady(true)
      return
    }

    const result = await listTreasuryMovements(companyId)
    if (result.data) {
      setMovements(result.data)
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

  const value = useMemo(
    () => ({
      movements,
      isReady,
      canWrite,
      canHardDelete,
      refresh,
      registerMovement,
      editMovement,
      cancelMovement,
      hardDeleteMovement,
    }),
    [
      movements,
      isReady,
      canWrite,
      canHardDelete,
      refresh,
      registerMovement,
      editMovement,
      cancelMovement,
      hardDeleteMovement,
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
