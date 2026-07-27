import type {
  CommercialStatusCode,
  CommercialPersonType,
} from "@/lib/commercial/catalogs"
import {
  isCommercialPriorityCode,
  isCommercialSourceCode,
  isCommercialStatusCode,
} from "@/lib/commercial/catalogs"
import {
  isValidOptionalEmail,
  type CommercialNewOpportunityInput,
  type CommercialNewOpportunityPersonInput,
} from "@/lib/commercial/create-opportunity"
import { hasCoordinates } from "@/lib/gps"

export type CommercialPersonFormValue = CommercialNewOpportunityPersonInput & {
  documentNumber: string
  taxId: string
  address: string
  city: string
  province: string
  postalCode: string
  notes: string
}

export type CommercialOpportunityFormValue = CommercialNewOpportunityInput & {
  status: CommercialStatusCode
  estimatedAmount: string
  probability: string
  expectedCloseDate: string
  lostReason: string
}

export function displayCommercialValue(
  value: string | number | null | undefined
): string {
  if (value === null || value === undefined) return "-"
  const text = String(value).trim()
  return text || "-"
}

export function formatCommercialDateTime(iso: string | null | undefined): string {
  if (!iso) return "-"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "-"
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${day}/${month}/${year} ${hours}:${minutes}`
}

export function formatCommercialDateOnly(
  value: string | null | undefined
): string {
  if (!value?.trim()) return "-"
  // Prefer YYYY-MM-DD without timezone shifts.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`
  }
  return displayCommercialValue(value)
}

export function formatCommercialMoney(
  value: number | null | undefined
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-"
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value)
}

export function personTypeLabel(type: CommercialPersonType): string {
  return type === "company" ? "Empresa" : "Persona"
}

export function resolvePersonPrimaryName(input: {
  personType: CommercialPersonType
  firstName: string
  lastName: string
  companyName: string
}): string {
  if (input.personType === "company") {
    return input.companyName.trim() || "-"
  }
  return `${input.firstName} ${input.lastName}`.trim() || "-"
}

export function validateCommercialPersonForm(
  value: CommercialPersonFormValue | CommercialNewOpportunityPersonInput
): string | null {
  if (value.personType === "individual") {
    if (!value.firstName.trim()) return "Ingrese el nombre del prospecto."
  } else if (!value.companyName.trim()) {
    return "Ingrese la razón social del prospecto."
  }
  if (!isValidOptionalEmail(value.email)) {
    return "Ingrese un email válido."
  }
  return null
}

export function validateCommercialOpportunityForm(
  value: CommercialOpportunityFormValue | CommercialNewOpportunityInput,
  options?: { requireStatus?: boolean }
): string | null {
  if (!value.title.trim()) return "Ingrese el título de la oportunidad."
  if (!value.assignedEmployeeId.trim()) return "Seleccione un responsable."
  if (!isCommercialSourceCode(value.source)) return "Seleccione un origen válido."
  if (!isCommercialPriorityCode(value.priority)) {
    return "Seleccione una prioridad válida."
  }

  if ("status" in value && options?.requireStatus !== false) {
    if (!isCommercialStatusCode(value.status)) {
      return "Seleccione un estado válido."
    }
  }

  if ("estimatedAmount" in value && value.estimatedAmount.trim()) {
    const amount = Number(value.estimatedAmount.replace(",", "."))
    if (Number.isNaN(amount) || amount < 0) {
      return "Ingrese un monto estimado válido."
    }
  }

  if ("probability" in value && value.probability.trim()) {
    const probability = Number(value.probability)
    if (
      Number.isNaN(probability) ||
      probability < 0 ||
      probability > 100 ||
      !Number.isInteger(probability)
    ) {
      return "La probabilidad debe ser un entero entre 0 y 100."
    }
  }

  if (
    "status" in value &&
    value.status === "perdida" &&
    "lostReason" in value &&
    !value.lostReason.trim()
  ) {
    return "Ingrese el motivo de pérdida."
  }

  const hasLat = value.latitude != null
  const hasLng = value.longitude != null
  if (hasLat !== hasLng) {
    return "La ubicación requiere latitud y longitud."
  }
  if (
    hasLat &&
    hasLng &&
    !hasCoordinates(value.latitude, value.longitude)
  ) {
    return "Las coordenadas de ubicación no son válidas."
  }
  if (
    hasCoordinates(value.latitude, value.longitude) &&
    !value.locationSource
  ) {
    return "Indique el origen de la ubicación."
  }

  return null
}

export function parseOptionalAmount(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return Number(trimmed.replace(",", "."))
}

export function parseOptionalProbability(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  return Number(trimmed)
}
