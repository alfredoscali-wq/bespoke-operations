import type { IspQueriesClient } from "@/lib/isp/queries"
import { ISP_SUBSCRIBER_REMOVAL_ERROR_MESSAGE } from "@/lib/isp/subscriber-removal"

export async function listRemovedIspSubscriberCustomerIds(
  client: IspQueriesClient,
  companyId: string
): Promise<Set<string>> {
  const ids = new Set<string>()
  const pageSize = 1000

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from("isp_subscribers")
      .select("customer_id")
      .eq("company_id", companyId)
      .not("deleted_at", "is", null)
      .order("customer_id", { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw new Error(error.message)

    const rows = data ?? []
    for (const row of rows) {
      if (row.customer_id) ids.add(row.customer_id)
    }
    if (rows.length < pageSize) break
  }

  return ids
}

export async function removeIspSubscriberMembership(
  client: IspQueriesClient,
  customerId: string
): Promise<{ alreadyRemoved: boolean }> {
  const { data, error } = await client.rpc("remove_isp_subscriber_membership", {
    p_customer_id: customerId,
  })

  if (error) {
    throw new Error(error.message)
  }

  const payload = (data ?? {}) as {
    success?: boolean
    alreadyRemoved?: boolean
  }

  if (payload.success === false) {
    throw new Error(ISP_SUBSCRIBER_REMOVAL_ERROR_MESSAGE)
  }

  return { alreadyRemoved: payload.alreadyRemoved === true }
}
