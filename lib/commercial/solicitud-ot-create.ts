/**
 * Open the existing Nueva OT form from a Commercial Solicitud context.
 * Mirrors consultation-ot-create (RC 3.2.6) without coupling to Atención.
 */

import { resolveCopiedGps } from "@/lib/tasks/work-order-location"

const STORAGE_PREFIX = "bespoke.solicitud-ot-prefill."

export type SolicitudOtCreatePrefill = {
  solicitudId: string
  opportunityId: string
  solicitudCode: string
  requestTypeName: string
  productPlan: string
  observations: string
  customerName: string
  customerPhone: string
  address: string
  locality: string
  latitude?: number | null
  longitude?: number | null
  sharedLocation?: string | null
  /** Trusted customers.id from the origin (e.g. opportunity.sourceCustomerId). Never inferred. */
  customerId?: string
}

export function readTrustedCustomerId(
  value: string | null | undefined
): string {
  return value?.trim() ?? ""
}

export function buildSolicitudOtLocationFromPerson(person: {
  address?: string | null
  street?: string | null
  city?: string | null
  latitude?: number | null
  longitude?: number | null
}): Pick<
  SolicitudOtCreatePrefill,
  "address" | "locality" | "latitude" | "longitude" | "sharedLocation"
> {
  const gps = resolveCopiedGps({
    latitude: person.latitude,
    longitude: person.longitude,
    sharedLocation: null,
  })

  return {
    address: person.address?.trim() || person.street?.trim() || "",
    locality: person.city?.trim() || "",
    latitude: gps.latitude,
    longitude: gps.longitude,
    sharedLocation: gps.sharedLocation || null,
  }
}

export function buildSolicitudOtCreateHref(solicitudId: string): string {
  const params = new URLSearchParams({
    nuevaOt: "1",
    solicitudId,
  })
  return `/tareas?${params.toString()}`
}

export function buildCrewObservationsFromSolicitud(
  prefill: SolicitudOtCreatePrefill
): string {
  const lines = [
    `Solicitud de origen: ${prefill.solicitudCode}`,
    `Tipo: ${prefill.requestTypeName || "—"}`,
  ]
  if (prefill.productPlan.trim()) {
    lines.push(`Producto / Plan: ${prefill.productPlan.trim()}`)
  }
  if (prefill.observations.trim()) {
    lines.push(`Observaciones: ${prefill.observations.trim()}`)
  }
  return lines.join("\n")
}

export function storeSolicitudOtCreatePrefill(
  prefill: SolicitudOtCreatePrefill
): void {
  if (typeof window === "undefined") return
  window.sessionStorage.setItem(
    `${STORAGE_PREFIX}${prefill.solicitudId}`,
    JSON.stringify(prefill)
  )
}

export function readSolicitudOtCreatePrefill(
  solicitudId: string
): SolicitudOtCreatePrefill | null {
  if (typeof window === "undefined" || !solicitudId) return null
  const raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${solicitudId}`)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as SolicitudOtCreatePrefill
    if (!parsed || parsed.solicitudId !== solicitudId) return null
    return parsed
  } catch {
    return null
  }
}

export function clearSolicitudOtCreatePrefill(solicitudId: string): void {
  if (typeof window === "undefined" || !solicitudId) return
  window.sessionStorage.removeItem(`${STORAGE_PREFIX}${solicitudId}`)
}
