import { createClient } from "@/lib/supabase/client"
import {
  fetchCustomerAtencionById,
  fetchOperatorActiveManagementRow,
  fetchSharedInboxBundle,
  fetchSharedInboxConsultations,
  fetchSharedInboxKpiSummary,
  insertCustomerAtencion,
  listCustomerAtencionesPaginated,
  type SharedInboxBundle,
  type SharedInboxConsultationsPage,
  type SupabaseCustomerAtencionesClient,
} from "@/lib/supabase/customer-atenciones.queries"
import { mapCustomerAtencionRowToCustomerAtencion } from "@/lib/supabase/customer-atenciones.mapper"
import { fetchEmployeeAtencionesForDay } from "@/lib/supabase/customer-seguimientos.queries"
import { insertCustomerSeguimiento } from "@/lib/supabase/customer-seguimientos.queries"
import type { CustomerAtencionListQuery } from "@/lib/customer-atenciones/atencion-list"
import type {
  SharedInboxKpiSummary,
  SharedInboxQuery,
} from "@/lib/customer-atenciones/shared-inbox"
import type {
  CustomerAtencion,
  CustomerAtencionInboxRow,
  CustomerAtencionListPage,
} from "@/lib/types/customer-atenciones"
import type { CustomerSeguimiento } from "@/lib/types/customer-seguimientos"
import type {
  CreateCustomerAtencionPayload,
  CustomerAtencionesRepositoryResult,
} from "@/lib/types/supabase/customer-atenciones"
import type {
  CreateCustomerSeguimientoPayload,
  CustomerSeguimientosRepositoryResult,
} from "@/lib/types/supabase/customer-seguimientos"

export function createBrowserCustomerAtencionesClient(): SupabaseCustomerAtencionesClient {
  return createClient()
}

export async function listAtencionPage(
  companyId: string,
  query: CustomerAtencionListQuery,
  client: SupabaseCustomerAtencionesClient = createBrowserCustomerAtencionesClient()
): Promise<CustomerAtencionesRepositoryResult<CustomerAtencionListPage>> {
  return listCustomerAtencionesPaginated(client, companyId, query)
}

export async function loadSharedInboxBundle(
  companyId: string,
  query: SharedInboxQuery,
  referenceDate: Date = new Date(),
  client: SupabaseCustomerAtencionesClient = createBrowserCustomerAtencionesClient()
): Promise<CustomerAtencionesRepositoryResult<SharedInboxBundle>> {
  return fetchSharedInboxBundle(client, companyId, query, referenceDate)
}

export async function getSharedInboxKpiSummary(
  companyId: string,
  referenceDate: Date = new Date(),
  client: SupabaseCustomerAtencionesClient = createBrowserCustomerAtencionesClient()
): Promise<CustomerAtencionesRepositoryResult<SharedInboxKpiSummary>> {
  return fetchSharedInboxKpiSummary(client, companyId, referenceDate)
}

export async function listSharedInboxConsultations(
  companyId: string,
  query: SharedInboxQuery,
  referenceDate: Date = new Date(),
  client: SupabaseCustomerAtencionesClient = createBrowserCustomerAtencionesClient()
): Promise<CustomerAtencionesRepositoryResult<SharedInboxConsultationsPage>> {
  return fetchSharedInboxConsultations(client, companyId, query, referenceDate)
}

export async function getCustomerAtencionById(
  id: string,
  companyId?: string,
  client: SupabaseCustomerAtencionesClient = createBrowserCustomerAtencionesClient()
): Promise<CustomerAtencionesRepositoryResult<CustomerAtencion>> {
  return fetchCustomerAtencionById(client, id, companyId)
}

export async function getOperatorActiveManagement(
  companyId: string,
  employeeId: string,
  client: SupabaseCustomerAtencionesClient = createBrowserCustomerAtencionesClient()
): Promise<CustomerAtencionesRepositoryResult<CustomerAtencionInboxRow | null>> {
  return fetchOperatorActiveManagementRow(client, companyId, employeeId)
}

export async function createCustomerAtencion(
  payload: CreateCustomerAtencionPayload,
  client: SupabaseCustomerAtencionesClient = createBrowserCustomerAtencionesClient()
): Promise<CustomerAtencionesRepositoryResult<CustomerAtencion>> {
  return insertCustomerAtencion(client, payload)
}

/**
 * Creates atención and optional seguimiento sequentially.
 * Atomicity: atención + consulta_creada event (DB trigger); seguimiento is best-effort.
 */
export async function createCustomerAtencionWithSeguimiento(
  atencionPayload: CreateCustomerAtencionPayload,
  seguimientoPayload: CreateCustomerSeguimientoPayload | null,
  client: SupabaseCustomerAtencionesClient = createBrowserCustomerAtencionesClient()
): Promise<
  | {
      data: { atencion: CustomerAtencion; seguimiento?: CustomerSeguimiento }
      error: null
    }
  | {
      data: null
      error: {
        code: "VALIDATION" | "FORBIDDEN" | "UNKNOWN"
        message: string
        partialAtencionId?: string
      }
    }
> {
  const atencionResult = await insertCustomerAtencion(client, atencionPayload)

  if (atencionResult.error || !atencionResult.data) {
    const repositoryError = atencionResult.error
    return {
      data: null,
      error: {
        code:
          repositoryError?.code === "VALIDATION" ||
          repositoryError?.code === "FORBIDDEN"
            ? repositoryError.code
            : "UNKNOWN",
        message:
          repositoryError?.message ?? "No se pudo registrar la atención.",
      },
    }
  }

  if (!seguimientoPayload) {
    return {
      data: { atencion: atencionResult.data },
      error: null,
    }
  }

  const seguimientoResult = await insertCustomerSeguimiento(client, {
    ...seguimientoPayload,
    sourceAtencionId: atencionResult.data.id,
  })

  if (seguimientoResult.error || !seguimientoResult.data) {
    const repositoryError = seguimientoResult.error
    return {
      data: null,
      error: {
        code:
          repositoryError?.code === "VALIDATION" ||
          repositoryError?.code === "FORBIDDEN"
            ? repositoryError.code
            : "UNKNOWN",
        message:
          repositoryError?.message ??
          "La atención se registró, pero no se pudo crear el seguimiento.",
        partialAtencionId: atencionResult.data.id,
      },
    }
  }

  return {
    data: {
      atencion: atencionResult.data,
      seguimiento: seguimientoResult.data,
    },
    error: null,
  }
}

export async function listEmployeeAtencionesToday(
  companyId: string,
  employeeId: string,
  referenceDate: Date = new Date(),
  client: SupabaseCustomerAtencionesClient = createBrowserCustomerAtencionesClient()
): Promise<CustomerAtencionesRepositoryResult<CustomerAtencion[]>> {
  const result = await fetchEmployeeAtencionesForDay(
    client,
    companyId,
    employeeId,
    referenceDate
  )

  if (result.error) {
    return { data: null, error: result.error }
  }

  return {
    data: result.data.map(mapCustomerAtencionRowToCustomerAtencion),
    error: null,
  }
}
