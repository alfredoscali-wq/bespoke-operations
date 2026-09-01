export const ISP_CONNECTION_DELETE_TITLE = "Eliminar conexión"
export const ISP_CONNECTION_DELETE_BODY =
  "Está a punto de eliminar esta conexión. Esta acción no podrá deshacerse."
export const ISP_CONNECTION_DELETE_CONFIRM_LABEL = "Eliminar definitivamente"
export const ISP_CONNECTION_NOT_FOUND_MESSAGE = "Conexión no encontrada."

/**
 * Core ISP graph that blocks a physical customer delete.
 * Admin "Eliminar definitivamente" clears these in
 * `deleteIspDependentsForCustomer` before deleting `customers`.
 * Do not CASCADE from customers.
 */
export const ISP_CUSTOMER_HARD_DELETE_DEPENDENCY_ORDER = [
  "isp_connection_equipment",
  "isp_connections",
  "isp_services",
  "isp_subscribers",
  "customers",
] as const

export const ISP_CUSTOMER_DELETE_BLOCKED_BY_SERVICES_CONSTRAINT =
  "isp_services_customer_id_fkey"
