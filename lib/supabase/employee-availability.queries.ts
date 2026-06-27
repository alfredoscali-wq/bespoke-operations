import type { SupabaseClient } from "@supabase/supabase-js"

import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import type { Database } from "@/lib/supabase/database.types"
import {
  mapCreateEmployeeAvailabilityPayloadToInsert,
  mapEmployeeAvailabilityRowToEmployeeAvailability,
  mapUpdateEmployeeAvailabilityPayloadToUpdate,
} from "@/lib/supabase/employee-availability.mapper"
import type { EmployeeAvailability } from "@/lib/types/availability"
import type {
  CreateEmployeeAvailabilityPayload,
  EmployeeAvailabilityRepositoryResult,
  UpdateEmployeeAvailabilityPayload,
} from "@/lib/types/supabase/availability"

export type SupabaseEmployeeAvailabilityClient = SupabaseClient<Database>

export function mapSupabaseEmployeeAvailabilityError(error: {
  code?: string
  message: string
}) {
  if (error.code === "23514") {
    return {
      code: "VALIDATION" as const,
      message: "La fecha fin debe ser mayor o igual a la fecha inicio.",
    }
  }

  return {
    code: "UNKNOWN" as const,
    message: error.message,
  }
}

export async function fetchEmployeeAvailabilities(
  client: SupabaseEmployeeAvailabilityClient,
  companyId: string
): Promise<EmployeeAvailabilityRepositoryResult<EmployeeAvailability[]>> {
  const { data, error } = await client
    .from("employee_availability")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("start_date", { ascending: false })

  if (error) {
    return { data: null, error: mapSupabaseEmployeeAvailabilityError(error) }
  }

  return {
    data: (data ?? []).map(mapEmployeeAvailabilityRowToEmployeeAvailability),
    error: null,
  }
}

export async function fetchEmployeeAvailabilityById(
  client: SupabaseEmployeeAvailabilityClient,
  id: string
): Promise<EmployeeAvailabilityRepositoryResult<EmployeeAvailability>> {
  const { data, error } = await client
    .from("employee_availability")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseEmployeeAvailabilityError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Registro de disponibilidad no encontrado.",
      },
    }
  }

  return {
    data: mapEmployeeAvailabilityRowToEmployeeAvailability(data),
    error: null,
  }
}

export async function fetchActiveAvailabilityByEmployee(
  client: SupabaseEmployeeAvailabilityClient,
  employeeId: string,
  referenceDate: string
): Promise<EmployeeAvailabilityRepositoryResult<EmployeeAvailability[]>> {
  const { data, error } = await client
    .from("employee_availability")
    .select("*")
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .lte("start_date", referenceDate)
    .gte("end_date", referenceDate)
    .order("start_date", { ascending: false })

  if (error) {
    return { data: null, error: mapSupabaseEmployeeAvailabilityError(error) }
  }

  return {
    data: (data ?? []).map(mapEmployeeAvailabilityRowToEmployeeAvailability),
    error: null,
  }
}

export async function insertEmployeeAvailability(
  client: SupabaseEmployeeAvailabilityClient,
  payload: CreateEmployeeAvailabilityPayload
): Promise<EmployeeAvailabilityRepositoryResult<EmployeeAvailability>> {
  const { data, error } = await client
    .from("employee_availability")
    .insert(
      mapCreateEmployeeAvailabilityPayloadToInsert({
        ...payload,
        companyId: payload.companyId ?? BESPOKE_PRODUCTION_COMPANY_ID,
      })
    )
    .select("*")
    .single()

  if (error) {
    return { data: null, error: mapSupabaseEmployeeAvailabilityError(error) }
  }

  return {
    data: mapEmployeeAvailabilityRowToEmployeeAvailability(data),
    error: null,
  }
}

export async function patchEmployeeAvailability(
  client: SupabaseEmployeeAvailabilityClient,
  id: string,
  payload: UpdateEmployeeAvailabilityPayload
): Promise<EmployeeAvailabilityRepositoryResult<EmployeeAvailability>> {
  const update = mapUpdateEmployeeAvailabilityPayloadToUpdate(payload)

  if (Object.keys(update).length === 0) {
    return {
      data: null,
      error: {
        code: "VALIDATION",
        message: "No se proporcionaron campos para actualizar.",
      },
    }
  }

  const { data, error } = await client
    .from("employee_availability")
    .update(update)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseEmployeeAvailabilityError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Registro de disponibilidad no encontrado.",
      },
    }
  }

  return {
    data: mapEmployeeAvailabilityRowToEmployeeAvailability(data),
    error: null,
  }
}

export async function softDeleteEmployeeAvailabilityRecord(
  client: SupabaseEmployeeAvailabilityClient,
  id: string
): Promise<EmployeeAvailabilityRepositoryResult<void>> {
  const { data, error } = await client
    .from("employee_availability")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseEmployeeAvailabilityError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Registro de disponibilidad no encontrado o ya fue eliminado.",
      },
    }
  }

  return { data: undefined, error: null }
}
