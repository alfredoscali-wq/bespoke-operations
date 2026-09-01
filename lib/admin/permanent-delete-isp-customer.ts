import type { SupabaseClient } from "@supabase/supabase-js"

import { ISP_CUSTOMER_HARD_DELETE_DEPENDENCY_ORDER } from "@/lib/isp/connection-delete"
import type { Database } from "@/lib/supabase/database.types"

type AdminClient = SupabaseClient<Database>

export const PERMANENT_DELETE_ISP_CUSTOMER_STEPS = [
  "select_isp_services",
  "select_isp_connections",
  "delete_isp_connection_equipment",
  "delete_isp_connections",
  "delete_isp_billing_run_items",
  "delete_isp_billing_documents",
  "clear_isp_services_replaced_service_id",
  "delete_isp_services",
  "delete_isp_subscribers",
] as const

export { ISP_CUSTOMER_HARD_DELETE_DEPENDENCY_ORDER }

async function throwIf(
  error: { message: string } | null,
  message: string
): Promise<void> {
  if (error) {
    throw new Error(`${message}: ${error.message}`)
  }
}

export async function deleteIspDependentsForCustomer(
  client: AdminClient,
  customerId: string
): Promise<void> {
  const { data: services, error: servicesError } = await client
    .from("isp_services")
    .select("id")
    .eq("customer_id", customerId)

  await throwIf(servicesError, "No se pudieron leer los servicios ISP del cliente")
  const serviceIds = (services ?? []).map((row) => row.id)

  if (serviceIds.length > 0) {
    const { data: connections, error: connectionsError } = await client
      .from("isp_connections")
      .select("id")
      .in("service_id", serviceIds)

    await throwIf(
      connectionsError,
      "No se pudieron leer las conexiones ISP del cliente"
    )
    const connectionIds = (connections ?? []).map((row) => row.id)

    if (connectionIds.length > 0) {
      const { error: equipmentError } = await client
        .from("isp_connection_equipment")
        .delete()
        .in("connection_id", connectionIds)
      await throwIf(
        equipmentError,
        "No se pudo eliminar el equipamiento de las conexiones"
      )

      const { error: connectionsDeleteError } = await client
        .from("isp_connections")
        .delete()
        .in("id", connectionIds)
      await throwIf(connectionsDeleteError, "No se pudieron eliminar las conexiones")
    }
  }

  const { error: runItemsError } = await client
    .from("isp_billing_run_items")
    .delete()
    .eq("customer_id", customerId)
  await throwIf(
    runItemsError,
    "No se pudieron eliminar las líneas de facturación mensual del cliente"
  )

  const { error: documentsError } = await client
    .from("isp_billing_documents")
    .delete()
    .eq("customer_id", customerId)
  await throwIf(
    documentsError,
    "No se pudieron eliminar los comprobantes del cliente"
  )

  if (serviceIds.length > 0) {
    const { error: clearReplacedError } = await client
      .from("isp_services")
      .update({ replaced_service_id: null })
      .in("id", serviceIds)
    await throwIf(
      clearReplacedError,
      "No se pudo desvincular el historial de planes del cliente"
    )

    const { error: servicesDeleteError } = await client
      .from("isp_services")
      .delete()
      .in("id", serviceIds)
    await throwIf(servicesDeleteError, "No se pudieron eliminar los servicios ISP")
  }

  const { error: subscribersError } = await client
    .from("isp_subscribers")
    .delete()
    .eq("customer_id", customerId)
  await throwIf(subscribersError, "No se pudo eliminar el abonado ISP")
}
