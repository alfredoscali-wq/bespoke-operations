"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react"

import { appendUploadHistoryEvent } from "@/lib/data/evidence-enrichment"
import { mockEvidence } from "@/lib/data/evidence"
import type { EvidenceRecord } from "@/lib/types/evidence"

type ReviewActionResult = {
  success: boolean
  message?: string
}

type EvidenceContextValue = {
  evidence: EvidenceRecord[]
  getEvidence: (id: string) => EvidenceRecord | undefined
  approveEvidence: (id: string) => ReviewActionResult
  rejectEvidence: (id: string, comment: string) => ReviewActionResult
}

const EvidenceContext = createContext<EvidenceContextValue | null>(null)

const REVIEWER = "Ing. Carlos Ruiz"

export function EvidenceProvider({ children }: { children: React.ReactNode }) {
  const [evidence, setEvidence] = useState<EvidenceRecord[]>(mockEvidence)

  const getEvidence = useCallback(
    (id: string) => evidence.find((item) => item.id === id),
    [evidence]
  )

  const approveEvidence = useCallback((id: string): ReviewActionResult => {
    let updated = false

    setEvidence((current) =>
      current.map((item) => {
        if (item.id !== id) return item

        if (item.status !== "pending-review") {
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

    return { success: true, message: "Evidencia aprobada correctamente." }
  }, [])

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

      return {
        success: true,
        message: "Evidencia rechazada. Se notificará al operario.",
      }
    },
    []
  )

  const value = useMemo(
    () => ({ evidence, getEvidence, approveEvidence, rejectEvidence }),
    [evidence, getEvidence, approveEvidence, rejectEvidence]
  )

  return (
    <EvidenceContext.Provider value={value}>{children}</EvidenceContext.Provider>
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
