import {
  ISP_COMMERCIAL_STATUSES,
  ISP_CONNECTION_TYPES,
  ISP_MONTHLY_COLLECTION_METHODS,
  ISP_TECHNICAL_STATUSES,
  ISP_TECHNOLOGIES,
  type IspCommercialStatus,
  type IspConnectionType,
  type IspMonthlyCollectionMethod,
  type IspTechnicalStatus,
  type IspTechnology,
} from "@/lib/isp/constants"
import type { VisualTone } from "@/lib/ui/visual-tokens"

export const ISP_TECHNOLOGY_LABELS: Record<IspTechnology, string> = {
  ftth: "FTTH",
  wireless: "Wireless",
}

export function formatIspTechnologyLabel(
  technology: IspTechnology | null | undefined | ""
): string {
  if (!technology) return "No aplica"
  return ISP_TECHNOLOGY_LABELS[technology]
}

export const ISP_COMMERCIAL_STATUS_LABELS: Record<IspCommercialStatus, string> =
  {
    pending_activation: "Pendiente de alta",
    active: "Activo",
    suspended: "Suspendido",
    cancelled: "Baja",
  }

export const ISP_TECHNICAL_STATUS_LABELS: Record<IspTechnicalStatus, string> = {
  pending_provision: "Provisionamiento pendiente",
  provisioned: "Provisionado",
  provision_error: "Error de provisioning",
  disconnected: "Desconectado",
}

export const ISP_CONNECTION_TYPE_LABELS: Record<IspConnectionType, string> = {
  pppoe: "PPPoE",
  static_ip: "IP estática",
  dhcp: "DHCP",
  other: "Otro",
}

export const ISP_MONTHLY_COLLECTION_LABELS: Record<
  IspMonthlyCollectionMethod,
  string
> = {
  pending: "Pendiente",
  siro: "SIRO",
}

export const ISP_COMMERCIAL_STATUS_TONES: Record<
  IspCommercialStatus,
  VisualTone
> = {
  pending_activation: "yellow",
  active: "green",
  suspended: "orange",
    cancelled: "red",
}

export const ISP_TECHNICAL_STATUS_TONES: Record<IspTechnicalStatus, VisualTone> =
  {
    pending_provision: "yellow",
    provisioned: "green",
    provision_error: "red",
    disconnected: "gray",
  }

export function isIspTechnology(value: string): value is IspTechnology {
  return (ISP_TECHNOLOGIES as readonly string[]).includes(value)
}

export function isIspCommercialStatus(
  value: string
): value is IspCommercialStatus {
  return (ISP_COMMERCIAL_STATUSES as readonly string[]).includes(value)
}

export function isIspTechnicalStatus(
  value: string
): value is IspTechnicalStatus {
  return (ISP_TECHNICAL_STATUSES as readonly string[]).includes(value)
}

export function isIspConnectionType(value: string): value is IspConnectionType {
  return (ISP_CONNECTION_TYPES as readonly string[]).includes(value)
}

export function isIspMonthlyCollectionMethod(
  value: string
): value is IspMonthlyCollectionMethod {
  return (ISP_MONTHLY_COLLECTION_METHODS as readonly string[]).includes(value)
}
