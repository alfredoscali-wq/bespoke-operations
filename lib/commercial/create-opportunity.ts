import type {
  CommercialLocationSource,
  CommercialPersonType,
  CommercialPriorityCode,
  CommercialSourceCode,
} from "@/lib/commercial/catalogs"
import {
  isCommercialLocationSource,
  isCommercialPriorityCode,
  isCommercialSourceCode,
} from "@/lib/commercial/catalogs"
import { hasCoordinates } from "@/lib/gps"

export type CommercialNewOpportunityPersonInput = {
  personType: CommercialPersonType
  firstName: string
  lastName: string
  companyName: string
  documentNumber: string
  phone: string
  mobile: string
  email: string
  street: string
  streetNumber: string
  floor: string
  apartment: string
  neighborhood: string
  city: string
  province: string
  postalCode: string
  address: string
  latitude: number | null
  longitude: number | null
  locationSource: CommercialLocationSource | null
  locationInput: string
}

export type CommercialNewOpportunityInput = {
  title: string
  assignedEmployeeId: string
  source: CommercialSourceCode
  priority: CommercialPriorityCode
  observations: string
  /** Required on create (Nuevo Cliente). Optional on edit forms. */
  etiquetaId?: string
  latitude: number | null
  longitude: number | null
  locationSource: CommercialLocationSource | null
}

export type CommercialCreateOpportunityBundleInput = {
  person: CommercialNewOpportunityPersonInput
  opportunity: CommercialNewOpportunityInput
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeCommercialEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function normalizeCommercialPhone(value: string): string {
  return value.trim()
}

export function isValidOptionalEmail(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  return EMAIL_PATTERN.test(trimmed)
}

/** Display title stored on opportunity when UI no longer collects a separate title. */
export function buildCommercialClientAutoTitle(person: {
  personType: CommercialPersonType
  firstName: string
  lastName: string
  companyName: string
}): string {
  if (person.personType === "company") {
    return person.companyName.trim()
  }
  return [person.firstName, person.lastName]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
}

export function validateCommercialCreateOpportunityBundle(
  input: CommercialCreateOpportunityBundleInput
): string | null {
  const { person, opportunity } = input

  if (person.personType === "individual") {
    if (!person.firstName.trim()) {
      return "Ingrese el nombre y apellido del cliente."
    }
  } else if (!person.companyName.trim()) {
    return "Ingrese la raz?n social del cliente."
  }

  if (!normalizeCommercialPhone(person.phone) && !normalizeCommercialPhone(person.mobile)) {
    return "Ingrese el tel?fono del cliente."
  }

  if (!isValidOptionalEmail(person.email)) {
    return "Ingrese un email v?lido."
  }

  if (!opportunity.etiquetaId?.trim()) {
    return "Seleccione una etiqueta."
  }

  const title =
    opportunity.title.trim() || buildCommercialClientAutoTitle(person)
  if (!title.trim()) {
    return "Ingrese el nombre del cliente."
  }

  if (!opportunity.assignedEmployeeId.trim()) {
    return "No hay un responsable disponible para asignar el cliente."
  }

  if (!isCommercialSourceCode(opportunity.source)) {
    return "Origen comercial inv?lido."
  }

  if (!isCommercialPriorityCode(opportunity.priority)) {
    return "Prioridad comercial inv?lida."
  }

  const hasLat = opportunity.latitude != null
  const hasLng = opportunity.longitude != null
  if (hasLat !== hasLng) {
    return "La ubicaci?n requiere latitud y longitud."
  }

  if (
    hasLat &&
    hasLng &&
    !hasCoordinates(opportunity.latitude, opportunity.longitude)
  ) {
    return "Las coordenadas de ubicaci?n no son v?lidas."
  }

  if (
    opportunity.locationSource != null &&
    !isCommercialLocationSource(opportunity.locationSource)
  ) {
    return "Origen de ubicaci?n inv?lido."
  }

  if (
    hasCoordinates(opportunity.latitude, opportunity.longitude) &&
    !opportunity.locationSource
  ) {
    return "Indique el origen de la ubicaci?n."
  }

  return null
}

export const EXISTING_PROSPECT_NOTICE =
  "Se encontr? un cliente existente. El alta se asociar? al registro actual."
