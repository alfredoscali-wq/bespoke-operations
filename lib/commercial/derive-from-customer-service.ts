import "server-only"

import { formatCustomerAtencionMotivoLabel } from "@/lib/customer-atenciones/format"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  insertCommercialOpportunity,
  insertCommercialPerson,
  findCommercialPersonByContact,
  patchCommercialOpportunity,
  fetchCommercialOpportunityById,
} from "@/lib/supabase/commercial.queries"
import { insertCommercialActivity } from "@/lib/supabase/commercial-activities.queries"
import { resolveCommercialPersonDisplayName } from "@/lib/supabase/commercial.mapper"
import { logOperationError } from "@/lib/operations/user-messages"
import type { CommercialOpportunity } from "@/lib/types/commercial"
import type { CustomerAtencionMotivo } from "@/lib/types/customer-atenciones"

const OPEN_STATUSES = [
  "nueva",
  "contactada",
  "calificada",
  "propuesta_enviada",
  "negociacion",
] as const

function splitCustomerName(name: string): {
  firstName: string
  lastName: string
} {
  const trimmed = name.trim().replace(/\s+/g, " ")
  if (!trimmed) return { firstName: "Cliente", lastName: "" }
  const parts = trimmed.split(" ")
  if (parts.length === 1) return { firstName: parts[0], lastName: "" }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  }
}

function employeeDisplayName(row: {
  first_name: string | null
  last_name: string | null
  preferred_name: string | null
}): string {
  const preferred = row.preferred_name?.trim() ?? ""
  if (preferred) return preferred
  return `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Usuario"
}

/**
 * When Atención derives to Ventas (`contactar_cliente`), create/reuse a commercial
 * opportunity and record a derivation activity. Failures are logged, never thrown
 * to the Atención flow.
 */
export async function deriveCommercialOpportunityFromCustomerService(input: {
  companyId: string
  atencionId: string
  employeeId: string
  detail?: string | null
}): Promise<{ opportunityId: string; created: boolean } | null> {
  try {
    const admin = createAdminClient()

    const { data: atencion, error: atencionError } = await admin
      .from("customer_atenciones")
      .select("id, company_id, customer_id, motivo, channel")
      .eq("id", input.atencionId)
      .eq("company_id", input.companyId)
      .maybeSingle()

    if (atencionError || !atencion) {
      logOperationError(
        "COMMERCIAL DERIVATION",
        atencionError ?? new Error("Atención no encontrada")
      )
      return null
    }

    const { data: customer, error: customerError } = await admin
      .from("customers")
      .select("id, name, phone, email, dni, address, locality, latitude, longitude")
      .eq("id", atencion.customer_id)
      .maybeSingle()

    if (customerError || !customer) {
      logOperationError(
        "COMMERCIAL DERIVATION",
        customerError ?? new Error("Cliente no encontrado")
      )
      return null
    }

    const { data: existingByAtencion } = await admin
      .from("commercial_opportunities")
      .select("id")
      .eq("company_id", input.companyId)
      .eq("source_atencion_id", input.atencionId)
      .is("deleted_at", null)
      .maybeSingle()

    let opportunity: CommercialOpportunity | null = null
    let created = false

    if (existingByAtencion?.id) {
      const fetched = await fetchCommercialOpportunityById(
        admin,
        existingByAtencion.id
      )
      opportunity = fetched.data
    }

    if (!opportunity) {
      const contactMatch = await findCommercialPersonByContact(
        admin,
        input.companyId,
        {
          email: customer.email ?? undefined,
          phone: customer.phone ?? undefined,
          mobile: customer.phone ?? undefined,
        }
      )

      let personId = contactMatch.data?.id ?? null

      if (!personId && customer.dni?.trim()) {
        const { data: byDni } = await admin
          .from("commercial_people")
          .select("id")
          .eq("company_id", input.companyId)
          .eq("document_number", customer.dni.trim())
          .is("deleted_at", null)
          .limit(1)
          .maybeSingle()
        personId = byDni?.id ?? null
      }

      if (!personId) {
        const { firstName, lastName } = splitCustomerName(customer.name)
        const personResult = await insertCommercialPerson(admin, {
          companyId: input.companyId,
          personType: "individual",
          firstName,
          lastName,
          documentNumber: customer.dni?.trim() ?? "",
          phone: customer.phone?.trim() ?? "",
          mobile: customer.phone?.trim() ?? "",
          email: customer.email?.trim() ?? "",
          address: customer.address?.trim() ?? "",
          city: customer.locality?.trim() ?? "",
          latitude: customer.latitude,
          longitude: customer.longitude,
          locationSource:
            customer.latitude != null && customer.longitude != null
              ? "customer_service"
              : null,
          notes: `Derivado desde Atención al Cliente (${input.atencionId}).`,
          createdBy: input.employeeId,
        })
        if (personResult.error || !personResult.data) {
          logOperationError(
            "COMMERCIAL DERIVATION",
            personResult.error ?? new Error("No se pudo crear la persona")
          )
          return null
        }
        personId = personResult.data.id
      }

      const { data: openOpp } = await admin
        .from("commercial_opportunities")
        .select("id")
        .eq("company_id", input.companyId)
        .eq("person_id", personId)
        .in("status", [...OPEN_STATUSES])
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (openOpp?.id) {
        const fetched = await fetchCommercialOpportunityById(admin, openOpp.id)
        opportunity = fetched.data
        if (opportunity) {
          await patchCommercialOpportunity(admin, opportunity.id, {
            source: "atencion_cliente",
            sourceAtencionId: input.atencionId,
            sourceCustomerId: customer.id,
            sellerOpenedAt: null,
            updatedBy: input.employeeId,
          })
          const refreshed = await fetchCommercialOpportunityById(
            admin,
            opportunity.id
          )
          opportunity = refreshed.data
        }
      } else {
        const personLabel =
          contactMatch.data != null
            ? resolveCommercialPersonDisplayName(contactMatch.data)
            : customer.name.trim() || "Cliente"
        const motivoLabel = formatCustomerAtencionMotivoLabel(
          atencion.motivo as CustomerAtencionMotivo
        )
        const createdOpp = await insertCommercialOpportunity(admin, {
          companyId: input.companyId,
          personId,
          title: `Derivación · ${personLabel}`,
          status: "nueva",
          priority: "media",
          source: "atencion_cliente",
          description: [
            `Derivado desde Atención al Cliente.`,
            motivoLabel ? `Motivo de consulta: ${motivoLabel}.` : "",
            input.detail?.trim() ? `Detalle: ${input.detail.trim()}` : "",
          ]
            .filter(Boolean)
            .join(" "),
          latitude: customer.latitude,
          longitude: customer.longitude,
          locationSource:
            customer.latitude != null && customer.longitude != null
              ? "customer_service"
              : null,
          sellerOpenedAt: null,
          sourceAtencionId: input.atencionId,
          sourceCustomerId: customer.id,
          createdBy: input.employeeId,
        })
        if (createdOpp.error || !createdOpp.data) {
          logOperationError(
            "COMMERCIAL DERIVATION",
            createdOpp.error ?? new Error("No se pudo crear la oportunidad")
          )
          return null
        }
        opportunity = createdOpp.data
        created = true
      }
    } else {
      await patchCommercialOpportunity(admin, opportunity.id, {
        sellerOpenedAt: null,
        sourceAtencionId: input.atencionId,
        sourceCustomerId: customer.id,
        source: "atencion_cliente",
        updatedBy: input.employeeId,
      })
    }

    if (!opportunity) return null

    const motivoLabel = formatCustomerAtencionMotivoLabel(
      atencion.motivo as CustomerAtencionMotivo
    )
    const { data: employee } = await admin
      .from("employees")
      .select("first_name, last_name, preferred_name")
      .eq("id", input.employeeId)
      .maybeSingle()

    const derivedByName = employee
      ? employeeDisplayName(employee)
      : "Atención al Cliente"

    const reason =
      input.detail?.trim() ||
      motivoLabel ||
      "Derivación desde Atención al Cliente"

    await insertCommercialActivity(admin, {
      companyId: input.companyId,
      opportunityId: opportunity.id,
      activityTypeCode: "derivacion",
      employeeId: input.employeeId,
      title: "Derivación desde Atención al Cliente",
      description: reason,
      status: "completed",
      completedAt: new Date().toISOString(),
      createdBy: input.employeeId,
      metadata: {
        automatic: true,
        event: "derivation_from_customer_service",
        atencionId: input.atencionId,
        customerId: customer.id,
        motivo: atencion.motivo,
        channel: atencion.channel,
        derivedByEmployeeId: input.employeeId,
        derivedByName,
        reason,
        detail: input.detail?.trim() || null,
      },
    })

    return { opportunityId: opportunity.id, created }
  } catch (error) {
    logOperationError("COMMERCIAL DERIVATION", error)
    return null
  }
}
