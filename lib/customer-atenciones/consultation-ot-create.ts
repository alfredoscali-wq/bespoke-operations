/**
 * RC 3.2.6 — open the existing Nueva OT form from a consultation context.
 */

import { formatConsultationExpedienteCode } from "@/lib/customer-atenciones/consultation-expediente"

const STORAGE_PREFIX = "bespoke.consultation-ot-prefill."

export type ConsultationOtCreatePrefill = {
  atencionId: string
  customerId: string
  expedienteCode: string
  motivoLabel: string
  initialObservations: string
  /** Optional technical / management notes for the crew field. */
  technicalHistory?: string | null
}

export function buildConsultationOtCreateHref(input: {
  atencionId: string
  customerId: string
}): string {
  const params = new URLSearchParams({
    nuevaOt: "1",
    atencionId: input.atencionId,
    customerId: input.customerId,
  })
  return `/tareas?${params.toString()}`
}

export function buildConsultationOtCreatePrefill(input: {
  atencionId: string
  customerId: string
  motivoLabel: string
  initialObservations?: string | null
  technicalHistory?: string | null
}): ConsultationOtCreatePrefill {
  return {
    atencionId: input.atencionId,
    customerId: input.customerId,
    expedienteCode: formatConsultationExpedienteCode(input.atencionId),
    motivoLabel: input.motivoLabel.trim() || "Consulta",
    initialObservations: input.initialObservations?.trim() || "",
    technicalHistory: input.technicalHistory?.trim() || null,
  }
}

export function buildCrewObservationsFromConsultation(
  prefill: ConsultationOtCreatePrefill
): string {
  const lines = [
    `Consulta de origen: ${prefill.expedienteCode}`,
    `Motivo: ${prefill.motivoLabel}`,
  ]

  if (prefill.initialObservations) {
    lines.push(`Observaciones iniciales: ${prefill.initialObservations}`)
  }

  if (prefill.technicalHistory) {
    lines.push(`Historial técnico: ${prefill.technicalHistory}`)
  }

  return lines.join("\n")
}

export function storeConsultationOtCreatePrefill(
  prefill: ConsultationOtCreatePrefill
): void {
  if (typeof window === "undefined") {
    return
  }
  window.sessionStorage.setItem(
    `${STORAGE_PREFIX}${prefill.atencionId}`,
    JSON.stringify(prefill)
  )
}

export function readConsultationOtCreatePrefill(
  atencionId: string
): ConsultationOtCreatePrefill | null {
  if (typeof window === "undefined" || !atencionId) {
    return null
  }

  const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${atencionId}`)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as ConsultationOtCreatePrefill
    if (
      !parsed ||
      parsed.atencionId !== atencionId ||
      typeof parsed.customerId !== "string"
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearConsultationOtCreatePrefill(atencionId: string): void {
  if (typeof window === "undefined" || !atencionId) {
    return
  }
  window.sessionStorage.removeItem(`${STORAGE_PREFIX}${atencionId}`)
}
