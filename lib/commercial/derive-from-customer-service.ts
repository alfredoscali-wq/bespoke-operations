import "server-only"

import { buildCommercialSalesHandoffResolution } from "@/lib/customer-atenciones/commercial-handoff"
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
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

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

async function ensureCommercialDerivationCatalog(
  admin: SupabaseClient<Database>
): Promise<void> {
  // Sprint 40.0 — catalog upserts are independent.
  const [sourceResult, typeResult] = await Promise.all([
    admin.from("commercial_sources").upsert(
      { code: "atencion_cliente", label: "Atención al Cliente", sort_order: 75 },
      { onConflict: "code", ignoreDuplicates: true }
    ),
    admin.from("commercial_activity_types").upsert(
      {
        code: "derivacion",
        label: "Derivación desde Atención al Cliente",
        sort_order: 95,
      },
      { onConflict: "code", ignoreDuplicates: true }
    ),
  ])
  if (sourceResult.error) {
    logOperationError("COMMERCIAL DERIVATION CATALOG", sourceResult.error)
  }
  if (typeResult.error) {
    logOperationError("COMMERCIAL DERIVATION CATALOG", typeResult.error)
  }
}

/**
 * After a commercial opportunity exists, the Atención case leaves the Ventas KPI
 * and becomes historical (ownership moves to Gestión Comercial).
 */
async function handOffAtencionAfterCommercialDerivation(
  admin: SupabaseClient<Database>,
  input: {
    companyId: string
    atencionId: string
    employeeId: string
    opportunityCode: string
  }
): Promise<boolean> {
  const nowIso = new Date().toISOString()
  const resolution = buildCommercialSalesHandoffResolution(input.opportunityCode)

  const { data, error } = await admin
    .from("customer_atenciones")
    .update({
      status: "resuelta",
      next_step: null,
      resultado: "resuelta",
      resolution,
      resolved_at: nowIso,
      resolved_by_employee_id: input.employeeId,
      active_management_employee_id: null,
      active_management_started_at: null,
      active_management_last_activity_at: null,
      updated_at: nowIso,
    })
    .eq("id", input.atencionId)
    .eq("company_id", input.companyId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle()

  if (error) {
    logOperationError("COMMERCIAL DERIVATION HANDOFF", error)
    return false
  }

  return Boolean(data?.id)
}

/**
 * When Atención derives to Ventas (`contactar_cliente`), create/reuse a commercial
 * opportunity, record the automatic derivation activity, and hand off the
 * Atención case so it leaves the Ventas KPI. Failures are logged and returned as
 * null (callers may still treat Atención RPC success independently).
 */
export async function deriveCommercialOpportunityFromCustomerService(input: {
  companyId: string
  atencionId: string
  employeeId: string
  detail?: string | null
}): Promise<{ opportunityId: string; created: boolean } | null> {
  try {
    const admin = createAdminClient()

    // Sprint 40.0 — catalog ensure + atención row are independent.
    const [, atencionResult] = await Promise.all([
      ensureCommercialDerivationCatalog(admin),
      admin
        .from("customer_atenciones")
        .select("id, company_id, customer_id, motivo, channel, status, next_step")
        .eq("id", input.atencionId)
        .eq("company_id", input.companyId)
        .maybeSingle(),
    ])

    const { data: atencion, error: atencionError } = atencionResult

    if (atencionError || !atencion) {
      logOperationError(
        "COMMERCIAL DERIVATION",
        atencionError ?? new Error("Atención no encontrada")
      )
      return null
    }

    // Sprint 40.0 — customer + existing opportunity-by-atencion are independent.
    const [customerResult, existingByAtencionResult] = await Promise.all([
      admin
        .from("customers")
        .select(
          "id, name, phone, email, dni, address, locality, latitude, longitude"
        )
        .eq("id", atencion.customer_id)
        .maybeSingle(),
      admin
        .from("commercial_opportunities")
        .select("id")
        .eq("company_id", input.companyId)
        .eq("source_atencion_id", input.atencionId)
        .is("deleted_at", null)
        .maybeSingle(),
    ])

    const { data: customer, error: customerError } = customerResult
    const { data: existingByAtencion } = existingByAtencionResult

    if (customerError || !customer) {
      logOperationError(
        "COMMERCIAL DERIVATION",
        customerError ?? new Error("Cliente no encontrado")
      )
      return null
    }

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
      const dni = customer.dni?.trim() || ""
      // Sprint 40.0 — contact + DNI person lookups are independent; contact wins.
      const [contactMatch, byDniResult] = await Promise.all([
        findCommercialPersonByContact(admin, input.companyId, {
          email: customer.email ?? undefined,
          phone: customer.phone ?? undefined,
          mobile: customer.phone ?? undefined,
        }),
        dni
          ? admin
              .from("commercial_people")
              .select("id")
              .eq("company_id", input.companyId)
              .eq("document_number", dni)
              .is("deleted_at", null)
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null as { id: string } | null }),
      ])

      let personId =
        contactMatch.data?.id ?? byDniResult.data?.id ?? null

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

    // Sprint 40.0 — activity insert and atención handoff are independent.
    const [activityResult, handedOff] = await Promise.all([
      insertCommercialActivity(admin, {
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
      }),
      handOffAtencionAfterCommercialDerivation(admin, {
        companyId: input.companyId,
        atencionId: input.atencionId,
        employeeId: input.employeeId,
        opportunityCode: opportunity.code,
      }),
    ])

    if (activityResult.error || !activityResult.data) {
      logOperationError(
        "COMMERCIAL DERIVATION ACTIVITY",
        activityResult.error ??
          new Error("No se pudo registrar la actividad de derivación")
      )
    }

    if (!handedOff) {
      logOperationError(
        "COMMERCIAL DERIVATION HANDOFF",
        new Error(
          `Oportunidad ${opportunity.id} creada pero la consulta ${input.atencionId} no se cerró en Atención.`
        )
      )
    }

    return { opportunityId: opportunity.id, created }
  } catch (error) {
    logOperationError("COMMERCIAL DERIVATION", error)
    return null
  }
}
