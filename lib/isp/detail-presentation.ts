import type { IspActivityEvent, IspServiceWithConnection } from "@/lib/isp/types"
import type { VisualTone } from "@/lib/ui/visual-tokens"

export type IspGeneralVisualStatus =
  | "active"
  | "pending"
  | "suspended"
  | "cancelled"
  | "none"

export type IspGeneralVisualStatusView = {
  key: IspGeneralVisualStatus
  label: string
  tone: VisualTone
}

export function deriveIspGeneralVisualStatus(
  services: Array<{ commercialStatus: string }>
): IspGeneralVisualStatusView {
  if (services.length === 0) {
    return { key: "none", label: "Sin servicios", tone: "gray" }
  }

  const live = services.filter((service) => service.commercialStatus !== "cancelled")
  if (live.length === 0) {
    return { key: "cancelled", label: "Baja", tone: "red" }
  }
  if (live.some((service) => service.commercialStatus === "suspended")) {
    return { key: "suspended", label: "Suspendido", tone: "orange" }
  }
  if (live.some((service) => service.commercialStatus === "active")) {
    return { key: "active", label: "Activo", tone: "green" }
  }
  if (live.some((service) => service.commercialStatus === "pending_activation")) {
    return { key: "pending", label: "Pendiente de instalación", tone: "yellow" }
  }

  return { key: "none", label: "Sin servicios", tone: "gray" }
}

export function formatIspMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—"
  return `$${value.toLocaleString("es-AR")}`
}

export function formatIspMoneyMonthly(value: number | null | undefined): string {
  const formatted = formatIspMoney(value)
  return formatted === "—" ? formatted : `${formatted} / mes`
}

export function parseIspDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatIspDate(value: string | null | undefined): string {
  const date = parseIspDate(value)
  return date ? date.toLocaleDateString("es-AR") : value?.trim() || "—"
}

export function formatIspTime(value: string | null | undefined): string {
  const date = parseIspDate(value)
  if (!date) return "—"
  if (!value?.includes("T")) return formatIspDate(value)
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
}

export function formatIspDayShort(value: string | null | undefined): string {
  const date = parseIspDate(value)
  if (!date) return "—"
  return date
    .toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
    .replace(".", "")
    .toUpperCase()
}

export function formatIspDocumentLine(dni: string | null | undefined): string | null {
  const value = dni?.trim()
  if (!value) return null
  const digits = value.replace(/\D/g, "")
  return digits.length >= 11 ? `CUIT ${value}` : `DNI ${value}`
}

export function customerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

export function contractedAbonoTotal(
  services: Array<{ commercialStatus: string; monthlyFee: number | null }>
): number | null {
  const live = services.filter((service) => service.commercialStatus !== "cancelled")
  const fees = live
    .map((service) => service.monthlyFee)
    .filter((fee): fee is number => fee != null && Number.isFinite(fee))
  if (fees.length === 0) return null
  return fees.reduce((sum, fee) => sum + fee, 0)
}

export function formatIspSpeedPair(service: {
  downloadSpeed?: number | null
  uploadSpeed?: number | null
  speedUnit?: string | null
}): string | null {
  if (service.downloadSpeed == null && service.uploadSpeed == null) return null
  const unit = (service.speedUnit ?? "Mbps").replace(/^mbps$/i, "Mbps")
  const down = service.downloadSpeed == null ? "—" : String(service.downloadSpeed)
  const up = service.uploadSpeed == null ? "—" : String(service.uploadSpeed)
  return `${down} ↓ / ${up} ↑ ${unit}`
}

export function workOrderVisualTone(status: string): VisualTone {
  const normalized = status.trim().toLowerCase()
  if (/finaliz|cerrad/.test(normalized)) return "green"
  if (/pendient|abiert|asign|curso/.test(normalized)) return "yellow"
  if (/cancel|anul/.test(normalized)) return "red"
  return "gray"
}

export function friendlyIspDetailError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : ""
  if (/abonado no encontrado/i.test(message)) return message
  return "No pudimos cargar la información."
}

export function groupIspActivityByDay(events: IspActivityEvent[]): Array<{
  year: string
  dayKey: string
  dayLabel: string
  events: IspActivityEvent[]
}> {
  const groups: Array<{
    year: string
    dayKey: string
    dayLabel: string
    events: IspActivityEvent[]
  }> = []

  for (const event of events) {
    const date = parseIspDate(event.occurredAt)
    const year = date ? String(date.getFullYear()) : ""
    const dayKey = date
      ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
      : event.occurredAt
    const existing = groups.find((group) => group.dayKey === dayKey)
    if (existing) {
      existing.events.push(event)
      continue
    }
    groups.push({
      year,
      dayKey,
      dayLabel: formatIspDayShort(event.occurredAt),
      events: [event],
    })
  }

  return groups
}

export function liveServices<T extends { commercialStatus: string }>(
  services: T[]
): T[] {
  return services.filter((service) => service.commercialStatus !== "cancelled")
}

export function summarizeIspServices(
  services: IspServiceWithConnection[]
): IspServiceWithConnection[] {
  return liveServices(services).slice(0, 4)
}
