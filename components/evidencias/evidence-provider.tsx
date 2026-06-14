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
import { createEvidenceFromInput, mockEvidence } from "@/lib/data/evidence"
import {
  createBrowserEvidencesClient,
  listEvidences,
  updateEvidence,
  uploadEvidenceWithFile,
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
}

const EvidenceContext = createContext<EvidenceContextValue | null>(null)

const REVIEWER = "Ing. Carlos Ruiz"

export function EvidenceProvider({ children }: { children: React.ReactNode }) {
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([])
  const [isEvidenceReady, setIsEvidenceReady] = useState(false)
  const [usesSupabase, setUsesSupabase] = useState(false)
  const usesSupabaseRef = useRef(false)

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
          setEvidence(mockEvidence)
          setUsesSupabase(false)
          return
        }

        setEvidence(result.data)
        setUsesSupabase(true)
      } catch {
        if (!cancelled) {
          setEvidence(mockEvidence)
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
      if (usesSupabaseRef.current) {
        try {
          const client = createBrowserEvidencesClient()
          const result = await uploadEvidenceWithFile(input, client)

          if (result.error || !result.data) {
            return {
              success: false,
              message: result.error?.message ?? "No se pudo subir la evidencia.",
            }
          }

          setEvidence((current) => [result.data!, ...current])

          return {
            success: true,
            data: result.data,
            message: "Evidencia subida correctamente.",
          }
        } catch {
          // Fall through to in-memory mock upload for this session.
        }
      }

      const uploadedAt = new Date().toISOString()
      const record = createEvidenceFromInput({
        fileName: input.file.name,
        type: "photo",
        projectId: input.projectId,
        projectCode: input.projectCode,
        projectName: input.projectName,
        taskId: input.taskId,
        taskCode: input.taskCode,
        taskTitle: input.taskTitle,
        crew: input.crew,
        worker: input.worker,
        uploadedAt,
        status: "pending-review",
        description: input.description ?? "",
        category: input.category ?? "Campo",
        comments: [],
      })

      setEvidence((current) => [record, ...current])

      return {
        success: true,
        data: record,
        message: "Evidencia registrada localmente.",
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

  const value = useMemo(
    () => ({
      evidence,
      isEvidenceReady,
      usesSupabase,
      getEvidence,
      uploadEvidence,
      approveEvidence,
      rejectEvidence,
    }),
    [
      evidence,
      isEvidenceReady,
      usesSupabase,
      getEvidence,
      uploadEvidence,
      approveEvidence,
      rejectEvidence,
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
