import type { VisualTone } from "@/lib/ui/visual-tokens"
import type {
  NetworkAgentStatus,
  NetworkDeviceStatus,
  NetworkDeviceType,
  NetworkJobStatus,
  NetworkJobType,
  NetworkSiteKind,
} from "@/lib/network/constants"

export const NETWORK_SITE_KIND_LABELS: Record<NetworkSiteKind, string> = {
  pop: "POP",
  node: "Nodo",
  tower: "Torre",
  datacenter: "Datacenter",
  office: "Oficina",
  other: "Otro",
}

export const NETWORK_AGENT_STATUS_LABELS: Record<NetworkAgentStatus, string> = {
  pending: "Pendiente",
  online: "Online",
  degraded: "Degradado",
  offline: "Offline",
  maintenance: "Mantenimiento",
}

export const NETWORK_AGENT_STATUS_TONES: Record<NetworkAgentStatus, VisualTone> =
  {
    pending: "yellow",
    online: "green",
    degraded: "amber",
    offline: "red",
    maintenance: "blue",
  }

export const NETWORK_JOB_TYPE_LABELS: Record<NetworkJobType, string> = {
  discovery: "Discovery",
  monitoring: "Monitoreo",
  backup: "Backup",
  diagnostic: "Diagnóstico",
  command: "Comando",
  verification: "Verificación",
}

export const NETWORK_JOB_STATUS_LABELS: Record<NetworkJobStatus, string> = {
  pending: "Pendiente",
  dispatched: "Despachado",
  running: "En ejecución",
  completed: "Completado",
  failed: "Fallido",
  cancelled: "Cancelado",
}

export const NETWORK_DEVICE_TYPE_LABELS: Record<NetworkDeviceType, string> = {
  core: "Core",
  router: "Router",
  switch: "Switch",
  ap: "AP",
  radio: "Radio",
  olt: "OLT",
  onu: "ONU",
  cpe: "CPE",
  other: "Otro",
}

export const NETWORK_DEVICE_STATUS_LABELS: Record<NetworkDeviceStatus, string> = {
  unknown: "Desconocido",
  online: "Online",
  offline: "Offline",
  degraded: "Degradado",
  maintenance: "Mantenimiento",
}

export const NETWORK_DEVICE_STATUS_TONES: Record<NetworkDeviceStatus, VisualTone> =
  {
    unknown: "gray",
    online: "green",
    offline: "red",
    degraded: "amber",
    maintenance: "blue",
  }

export const NETWORK_JOB_STATUS_TONES: Record<NetworkJobStatus, VisualTone> = {
  pending: "yellow",
  dispatched: "blue",
  running: "blue",
  completed: "green",
  failed: "red",
  cancelled: "gray",
}

export function formatNetworkLastSeen(value: string | null | undefined): string {
  if (!value) return "Sin heartbeat"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Sin heartbeat"
  return date.toLocaleString("es-AR")
}

export function formatNetworkTimestamp(
  value: string | null | undefined,
  empty = "—"
): string {
  if (!value) return empty
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return empty
  return date.toLocaleString("es-AR")
}

export function formatNetworkHistoryChangedAt(
  value: string | null | undefined
): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  const day = date.toLocaleDateString("es-AR", { day: "numeric", month: "short" })
  const time = date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  return `${day} · ${time}`
}

/** Formats API durationSeconds. Does not recompute from timestamps. */
export function formatNetworkHistoryDuration(
  durationSeconds: number | null | undefined
): string {
  if (durationSeconds == null || !Number.isFinite(durationSeconds)) {
    return "abierta"
  }
  const seconds = Math.max(0, Math.floor(durationSeconds))
  if (seconds < 60) return `${seconds} s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h`
  return `${Math.floor(seconds / 86400)} d`
}

export function formatNetworkBytes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  const units = ["B", "KB", "MB", "GB", "TB"]
  let amount = value
  let unit = 0
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024
    unit += 1
  }
  const digits = unit === 0 ? 0 : amount >= 10 ? 1 : 2
  return `${amount.toFixed(digits)} ${units[unit]}`
}

export function formatNetworkMemory(value: number | null | undefined): string {
  return formatNetworkBytes(value)
}

export function formatNetworkCpu(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${Math.round(value)}%`
}

export function formatNetworkTemperature(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—"
  return `${value} °C`
}
