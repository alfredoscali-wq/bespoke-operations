export const ISP_TECHNOLOGIES = ["ftth", "wireless"] as const
export type IspTechnology = (typeof ISP_TECHNOLOGIES)[number]

export const ISP_COMMERCIAL_STATUSES = [
  "pending_activation",
  "active",
  "suspended",
  "cancelled",
] as const
export type IspCommercialStatus = (typeof ISP_COMMERCIAL_STATUSES)[number]

export const ISP_TECHNICAL_STATUSES = [
  "pending_provision",
  "provisioned",
  "provision_error",
  "disconnected",
] as const
export type IspTechnicalStatus = (typeof ISP_TECHNICAL_STATUSES)[number]

export const ISP_CONNECTION_TYPES = [
  "pppoe",
  "static_ip",
  "dhcp",
  "other",
] as const
export type IspConnectionType = (typeof ISP_CONNECTION_TYPES)[number]

export const ISP_MONTHLY_COLLECTION_METHODS = ["pending", "siro"] as const
export type IspMonthlyCollectionMethod =
  (typeof ISP_MONTHLY_COLLECTION_METHODS)[number]

export const ISP_EMPTY_CONNECTIONS_MESSAGE =
  "Este cliente no tiene conexiones activas."

export const ISP_EMPTY_SERVICES_MESSAGE =
  "Este abonado todavía no tiene servicios registrados."

export const ISP_SUBSCRIBER_NOT_FOUND_MESSAGE = "Abonado no encontrado."

export const ISP_SERVICE_WITHOUT_CONNECTION_MESSAGE =
  "Servicio sin conexión técnica"

export const ISP_BILLING_PLACEHOLDER = "Facturación próximamente"
export const ISP_PAYMENTS_PLACEHOLDER =
  "Los pagos del abono mensual se registrarán cuando exista facturación."
export const ISP_COMMUNICATIONS_PLACEHOLDER =
  "WhatsApp, email y avisos se integrarán en un sprint posterior."
export const ISP_MONITORING_PLACEHOLDER = "Sin datos de monitoreo disponibles"
export const ISP_CORE_NOT_CONNECTED_MESSAGE =
  "MikroTik / Core no está integrado en este sprint."
export const ISP_ACTION_NOT_IMPLEMENTED_MESSAGE =
  "Esta acción quedará disponible cuando exista integración con el Core."

export const NEW_INSTALLATION_SERVICE_TYPE = "instalacion-nueva"
