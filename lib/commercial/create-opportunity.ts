import type {
  CommercialPersonType,
  CommercialPriorityCode,
  CommercialSourceCode,
} from "@/lib/commercial/catalogs"
import {
  isCommercialPriorityCode,
  isCommercialSourceCode,
} from "@/lib/commercial/catalogs"

export type CommercialNewOpportunityPersonInput = {
  personType: CommercialPersonType
  firstName: string
  lastName: string
  companyName: string
  phone: string
  mobile: string
  email: string
}

export type CommercialNewOpportunityInput = {
  title: string
  assignedEmployeeId: string
  source: CommercialSourceCode
  priority: CommercialPriorityCode
  observations: string
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

export function validateCommercialCreateOpportunityBundle(
  input: CommercialCreateOpportunityBundleInput
): string | null {
  const { person, opportunity } = input

  if (person.personType === "individual") {
    if (!person.firstName.trim()) {
      return "Ingrese el nombre del prospecto."
    }
  } else if (!person.companyName.trim()) {
    return "Ingrese la razón social del prospecto."
  }

  if (!isValidOptionalEmail(person.email)) {
    return "Ingrese un email válido."
  }

  if (!opportunity.title.trim()) {
    return "Ingrese el título de la oportunidad."
  }

  if (!opportunity.assignedEmployeeId.trim()) {
    return "Seleccione un responsable."
  }

  if (!isCommercialSourceCode(opportunity.source)) {
    return "Seleccione un origen válido."
  }

  if (!isCommercialPriorityCode(opportunity.priority)) {
    return "Seleccione una prioridad válida."
  }

  return null
}

export const EXISTING_PROSPECT_NOTICE =
  "Se encontró un prospecto existente. La oportunidad será asociada al registro actual."
