import { abnetNumberFromExternalCode } from "@/lib/isp/abnet-master-universe"
import { loadLiveAbnetCustomers } from "@/lib/isp/abnet-connection-registry-read"
import type { IspQueriesClient } from "@/lib/isp/queries"
import { removeIspSubscriberMembership } from "@/lib/isp/subscriber-removal-queries"
import { createCustomer, updateCustomer } from "@/lib/supabase/customers.queries"

export const CLIENTS360_SHARED_FICHA_MESSAGE =
  "El número ABNet está en más de una ficha Bespoke. La acción queda pendiente de revisión manual para no elegir una ficha al azar ni modificar el padrón importado."

export type Clients360FichaMatch = { id: string }

export type Clients360IdentityFields = {
  name: string
  dni?: string | null
  phone?: string | null
  whatsapp?: string | null
  email?: string | null
  address?: string | null
  locality?: string | null
  technology?: string | null
}

export function planClients360FichaSave(matches: readonly Clients360FichaMatch[]) {
  if (matches.length > 1) {
    return { ok: false as const, message: CLIENTS360_SHARED_FICHA_MESSAGE }
  }
  if (matches.length === 1) {
    return { ok: true as const, action: "update" as const, customerId: matches[0].id }
  }
  return { ok: true as const, action: "create" as const }
}

export function planClients360FichaRemoval(matches: readonly Clients360FichaMatch[]) {
  if (matches.length > 1) {
    return { ok: false as const, message: CLIENTS360_SHARED_FICHA_MESSAGE }
  }
  if (matches.length === 1) {
    return { ok: true as const, action: "remove" as const, customerId: matches[0].id }
  }
  return { ok: true as const, action: "remove_new" as const }
}

async function matchingFichas(
  client: IspQueriesClient,
  companyId: string,
  abnetNumber: string
): Promise<Clients360FichaMatch[]> {
  const live = await loadLiveAbnetCustomers(client, companyId)
  if (live.error) throw new Error(live.error.message)
  return live.customers
    .filter((row) => abnetNumberFromExternalCode(row.externalCode) === abnetNumber)
    .map((row) => ({ id: row.id }))
}

async function ensureActiveMembership(
  client: IspQueriesClient,
  companyId: string,
  customerId: string
) {
  const loose = client as unknown as {
    rpc: (
      fn: string,
      args: Record<string, string>
    ) => Promise<{ error: { message: string } | null }>
  }
  const { error } = await loose.rpc("ensure_isp_subscriber", {
    p_company_id: companyId,
    p_customer_id: customerId,
    p_source: "onboarding",
  })
  if (error) throw new Error(error.message)
}

export async function saveClients360PadronIdentity(
  client: IspQueriesClient,
  companyId: string,
  abnetNumber: string,
  fields: Clients360IdentityFields
): Promise<{ ok: true; customerId: string } | { ok: false; message: string }> {
  const plan = planClients360FichaSave(await matchingFichas(client, companyId, abnetNumber))
  if (!plan.ok) return plan
  const identity = {
    name: fields.name,
    dni: fields.dni,
    phone: fields.phone,
    whatsapp: fields.whatsapp,
    email: fields.email,
    address: fields.address,
    locality: fields.locality,
    technology: fields.technology,
    externalCustomerCode: abnetNumber,
  }
  if (plan.action === "update") {
    const updated = await updateCustomer(client, plan.customerId, identity)
    if (updated.error) return { ok: false, message: updated.error.message }
    await ensureActiveMembership(client, companyId, plan.customerId)
    return { ok: true, customerId: plan.customerId }
  }
  const created = await createCustomer(client, {
    companyId,
    ...identity,
    status: "activo",
  })
  if (created.error || !created.data) {
    return {
      ok: false,
      message: created.error?.message ?? "No se pudo crear la ficha Bespoke.",
    }
  }
  await ensureActiveMembership(client, companyId, created.data.id)
  return { ok: true, customerId: created.data.id }
}

export async function removeClients360PadronRecord(
  client: IspQueriesClient,
  companyId: string,
  abnetNumber: string
): Promise<{ ok: true; customerId: string } | { ok: false; message: string }> {
  const plan = planClients360FichaRemoval(await matchingFichas(client, companyId, abnetNumber))
  if (!plan.ok) return plan
  let customerId = plan.action === "remove" ? plan.customerId : null
  if (!customerId) {
    const created = await createCustomer(client, {
      companyId,
      name: `Abonado ${abnetNumber}`,
      externalCustomerCode: abnetNumber,
      status: "activo",
    })
    if (created.error || !created.data) {
      return {
        ok: false,
        message: created.error?.message ?? "No se pudo registrar la baja en Clientes 360.",
      }
    }
    customerId = created.data.id
  }
  await removeIspSubscriberMembership(client, customerId)
  return { ok: true, customerId }
}
