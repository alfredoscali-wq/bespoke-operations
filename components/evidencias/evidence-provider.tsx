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

import { appendUploadHistoryEvent } from "@/lib/data/evidence-enrichment"
import { useAuth } from "@/components/auth/auth-provider"
import { resolveEvidenceActor } from "@/lib/auth/auth-display"
import { normalizeUploadEvidenceInput } from "@/lib/auth/evidence-uploader"
import { EVIDENCE_VOID_HISTORY_ACTION } from "@/lib/evidence/utils"
import { logOperationError } from "@/lib/operations/user-messages"
import {
  createBrowserEvidencesClient,
  listEvidences,
  updateEvidence,
  uploadEvidenceWithFile,
  voidEvidence as voidEvidenceInSupabase,
} from "@/lib/supabase/evidences.browser"
import type { EvidenceRecord, EvidenceStatus } from "@/lib/types/evidence"
import type {
  UploadEvidenceInput,
  UploadEvidenceResult,
} from "@/lib/types/supabase/evidences"

type ReviewActionResult = {
  success: boolean
  message?: string
}

type EvidenceContextValue = {
  evidence: EvidenceRecord[]
  isEvidenceReady: boolean
  usesSupabase: boolean
  getEvidence: (id: string) => EvidenceRecord | undefined
  uploadEvidence: (input: UploadEvidenceInput) => Promise<UploadEvidenceResult>
  approveEvidence: (id: string) => ReviewActionResult
  rejectEvidence: (id: string, comment: string) => ReviewActionResult
  voidEvidence: (id: string, reason: string) => ReviewActionResult
}

const EvidenceContext = createContext<EvidenceContextValue | null>(null)

const REVIEWER = "Ing. Carlos Ruiz"

export function EvidenceProvider({ children }: { children: React.ReactNode }) {
  const { sessionUser } = useAuth()
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([])
  const [isEvidenceReady, setIsEvidenceReady] = useState(false)
  const [usesSupabase, setUsesSupabase] = useState(false)
  const usesSupabaseRef = useRef(false)
  const sessionUserRef = useRef(sessionUser)

  useEffect(() => {
    sessionUserRef.current = sessionUser
  }, [sessionUser])

  useEffect(() => {
    usesSupabaseRef.current = usesSupabase
  }, [usesSupabase])

  useEffect(() => {
    let cancelled = false

    async function loadEvidenceFromSupabase() {
      try {
        const client = createBrowserEvidencesClient()
        const result = await listEvidences(client)

        if (cancelled) return

        if (result.error || result.data === null) {
          console.error("[EVIDENCE LOAD]", result.error)
          setEvidence([])
          setUsesSupabase(false)
          return
        }

        setEvidence(result.data)
        setUsesSupabase(true)
      } catch (error) {
        if (!cancelled) {
          console.error("[EVIDENCE LOAD]", error)
          setEvidence([])
          setUsesSupabase(false)
        }
      } finally {
        if (!cancelled) {
          setIsEvidenceReady(true)
        }
      }
    }

    void loadEvidenceFromSupabase()

    return () => {
      cancelled = true
    }
  }, [])

  const persistEvidenceStatus = useCallback(
    async (id: string, status: EvidenceStatus) => {
      if (!usesSupabaseRef.current) return

      try {
        const client = createBrowserEvidencesClient()
        await updateEvidence(id, { status }, client)
      } catch {
        // Keep optimistic local state if persistence fails.
      }
    },
    []
  )

  const uploadEvidence = useCallback(
    async (input: UploadEvidenceInput): Promise<UploadEvidenceResult> => {
      const normalized = normalizeUploadEvidenceInput(
        input,
        sessionUserRef.current
      )

      if (!usesSupabaseRef.current) {
        return {
          success: false,
          message: "No se pudo subir la evidencia. Intente nuevamente.",
        }
      }

      try {
        const client = createBrowserEvidencesClient()
        const result = await uploadEvidenceWithFile(normalized, client)

        if (result.error || !result.data) {
          logOperationError("EVIDENCE UPLOAD", result.error)
          return {
            success: false,
            message: "No se pudo subir la evidencia. Intente nuevamente.",
          }
        }

        setEvidence((current) => [result.data!, ...current])

        return {
          success: true,
          data: result.data,
          message: "Evidencia subida correctamente.",
        }
      } catch (error) {
        logOperationError("EVIDENCE UPLOAD", error)
        return {
          success: false,
          message: "No se pudo subir la evidencia. Intente nuevamente.",
        }
      }
    },
    []
  )

  const getEvidence = useCallback(
    (id: string) => evidence.find((item) => item.id === id),
    [evidence]
  )

  const approveEvidence = useCallback(
    (id: string): ReviewActionResult => {
      let updated = false

      setEvidence((current) =>
        current.map((item) => {
          if (item.id !== id) return item

          if (item.status !== "pending-review") {
            return item
          }

          if (item.deletedAt) {
            return item
          }

          updated = true
          const timestamp = new Date().toISOString()

          return {
            ...item,
            status: "approved",
            uploadHistory: appendUploadHistoryEvent(item, {
              action: "Evidencia aprobada",
              user: REVIEWER,
              timestamp,
              note: "Validación completada por supervisión",
            }),
          }
        })
      )

      if (!updated) {
        return {
          success: false,
          message: "Solo se pueden aprobar evidencias pendientes de revisión.",
        }
      }

      void persistEvidenceStatus(id, "approved")

      return { success: true, message: "Evidencia aprobada correctamente." }
    },
    [persistEvidenceStatus]
  )

  const rejectEvidence = useCallback(
    (id: string, comment: string): ReviewActionResult => {
      const trimmed = comment.trim()
      if (!trimmed) {
        return {
          success: false,
          message: "Debe indicar el motivo del rechazo.",
        }
      }

      let updated = false

      setEvidence((current) =>
        current.map((item) => {
          if (item.id !== id) return item

          if (item.status !== "pending-review") {
            return item
          }

          if (item.deletedAt) {
            return item
          }

          updated = true
          const timestamp = new Date().toISOString()

          return {
            ...item,
            status: "rejected",
            comments: [
              ...item.comments,
              {
                id: `ec-${Date.now()}`,
                author: REVIEWER,
                role: "supervisor" as const,
                content: trimmed,
                timestamp,
              },
            ],
            uploadHistory: appendUploadHistoryEvent(item, {
              action: "Evidencia rechazada",
              user: REVIEWER,
              timestamp,
              note: trimmed,
            }),
          }
        })
      )

      if (!updated) {
        return {
          success: false,
          message: "Solo se pueden rechazar evidencias pendientes de revisión.",
        }
      }

      void persistEvidenceStatus(id, "rejected")

      return {
        success: true,
        message: "Evidencia rechazada. Se notificará al operario.",
      }
    },
    [persistEvidenceStatus]
  )

  const voidEvidence = useCallback(
    (id: string, reason: string): ReviewActionResult => {
      const trimmed = reason.trim()
      if (!trimmed) {
        return {
          success: false,
          message: "Debe indicar el motivo de la anulación.",
        }
      }

      const existing = evidence.find((item) => item.id === id)
      if (!existing) {
        return { success: false, message: "Evidencia no encontrada." }
      }

      if (existing.deletedAt) {
        return {
          success: false,
          message: "Esta evidencia ya fue anulada.",
        }
      }

      const voidedAt = new Date().toISOString()
      const actor = resolveEvidenceActor(sessionUserRef.current)
      let updatedRecord: EvidenceRecord | undefined

      setEvidence((current) =>
        current.map((item) => {
          if (item.id !== id) return item

          updatedRecord = {
            ...item,
            deletedAt: voidedAt,
            uploadHistory: appendUploadHistoryEvent(item, {
              action: EVIDENCE_VOID_HISTORY_ACTION,
              user: actor.name,
              timestamp: voidedAt,
              note: trimmed,
              role: actor.role,
            }),
          }

          return updatedRecord
        })
      )

      if (usesSupabaseRef.current && updatedRecord) {
        void voidEvidenceInSupabase(id, {
          reason: trimmed,
          voidedBy: actor.name,
          voidedByRole: actor.role,
          uploadHistory: updatedRecord.uploadHistory,
        }).catch(() => {
          // Keep optimistic local state if persistence fails.
        })
      }

      return {
        success: true,
        message: "Evidencia anulada correctamente.",
      }
    },
    [evidence]
  )

  const value = useMemo(
    () => ({
      evidence,
      isEvidenceReady,
      usesSupabase,
      getEvidence,
      uploadEvidence,
      approveEvidence,
      rejectEvidence,
      voidEvidence,
    }),
    [
      evidence,
      isEvidenceReady,
      usesSupabase,
      getEvidence,
      uploadEvidence,
      approveEvidence,
      rejectEvidence,
      voidEvidence,
    ]
  )

  return (
    <EvidenceContext.Provider value={value}>
      {isEvidenceReady ? children : null}
    </EvidenceContext.Provider>
  )
}

export function useEvidence() {
  const context = useContext(EvidenceContext)
  if (!context) {
    throw new Error("useEvidence must be used within EvidenceProvider")
  }
  return context
}

export function useEvidenceOptional() {
  return useContext(EvidenceContext)
}
