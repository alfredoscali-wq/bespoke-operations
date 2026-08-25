import type { IspQueriesClient } from "@/lib/isp/queries"

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

  return { alreadyRemoved: payload.alreadyRemoved === true }
}
