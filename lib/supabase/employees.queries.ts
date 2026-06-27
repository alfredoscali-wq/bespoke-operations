import type { SupabaseClient } from "@supabase/supabase-js"

import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import {
  buildEmployeeSoftDeleteRequestUrl,
  logEmployeeSoftDeleteAttempt,
  logEmployeeSoftDeleteResult,
} from "@/lib/supabase/employees-delete-diagnostics"
import type { Database } from "@/lib/supabase/database.types"
import {
  mapCreateEmployeePayloadToInsert,
  mapEmployeeRowToEmployee,
  mapUpdateEmployeePayloadToUpdate,
} from "@/lib/supabase/employees.mapper"
import type { Employee } from "@/lib/types/employees"
import type {
  CreateEmployeePayload,
  EmployeesRepositoryResult,
  UpdateEmployeePayload,
} from "@/lib/types/supabase/employees"

export type SupabaseEmployeesClient = SupabaseClient<Database>

export function mapSupabaseEmployeeError(error: {
  code?: string
  message: string
}) {
  if (error.code === "23505") {
    const message = error.message.toLowerCase()

    if (message.includes("employees_company_email_unique")) {
      return {
        code: "DUPLICATE_EMAIL" as const,
        message: "Ya existe un empleado con ese correo electrónico.",
      }
    }

    if (message.includes("employees_company_code_unique")) {
      return {
        code: "DUPLICATE_CODE" as const,
        message: "Ya existe un empleado con ese código.",
      }
    }

    return {
      code: "DUPLICATE_CODE" as const,
      message: "Ya existe un empleado con esos datos únicos.",
    }
  }

  return {
    code: "UNKNOWN" as const,
    message: error.message,
  }
}

export async function fetchEmployees(
  client: SupabaseEmployeesClient,
  companyId: string
): Promise<EmployeesRepositoryResult<Employee[]>> {
  const { data, error } = await client
    .from("employees")
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })

  if (error) {
    return { data: null, error: mapSupabaseEmployeeError(error) }
  }

  return {
    data: (data ?? []).map(mapEmployeeRowToEmployee),
    error: null,
  }
}

export async function fetchEmployeeById(
  client: SupabaseEmployeesClient,
  id: string
): Promise<EmployeesRepositoryResult<Employee>> {
  const { data, error } = await client
    .from("employees")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseEmployeeError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Empleado no encontrado.",
      },
    }
  }

  return {
    data: mapEmployeeRowToEmployee(data),
    error: null,
  }
}

export async function fetchEmployeeByCode(
  client: SupabaseEmployeesClient,
  employeeCode: string,
  companyId: string = BESPOKE_PRODUCTION_COMPANY_ID
): Promise<EmployeesRepositoryResult<Employee>> {
  const { data, error } = await client
    .from("employees")
    .select("*")
    .eq("company_id", companyId)
    .eq("employee_code", employeeCode.trim())
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseEmployeeError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Empleado no encontrado.",
      },
    }
  }

  return {
    data: mapEmployeeRowToEmployee(data),
    error: null,
  }
}

export async function fetchEmployeeByAppUserId(
  client: SupabaseEmployeesClient,
  appUserId: string
): Promise<EmployeesRepositoryResult<Employee>> {
  const { data, error } = await client
    .from("employees")
    .select("*")
    .eq("app_user_id", appUserId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseEmployeeError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Empleado no encontrado para este usuario.",
      },
    }
  }

  return {
    data: mapEmployeeRowToEmployee(data),
    error: null,
  }
}

export async function insertEmployee(
  client: SupabaseEmployeesClient,
  payload: CreateEmployeePayload
): Promise<EmployeesRepositoryResult<Employee>> {
  const { data, error } = await client
    .from("employees")
    .insert(mapCreateEmployeePayloadToInsert(payload))
    .select("*")
    .single()

  if (error) {
    return { data: null, error: mapSupabaseEmployeeError(error) }
  }

  return {
    data: mapEmployeeRowToEmployee(data),
    error: null,
  }
}

export async function patchEmployee(
  client: SupabaseEmployeesClient,
  id: string,
  payload: UpdateEmployeePayload
): Promise<EmployeesRepositoryResult<Employee>> {
  const update = mapUpdateEmployeePayloadToUpdate(payload)

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
    .from("employees")
    .update(update)
    .eq("id", id)
    .is("deleted_at", null)
    .select("*")
    .maybeSingle()

  if (error) {
    return { data: null, error: mapSupabaseEmployeeError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Empleado no encontrado.",
      },
    }
  }

  return {
    data: mapEmployeeRowToEmployee(data),
    error: null,
  }
}

export async function softDeleteEmployee(
  client: SupabaseEmployeesClient,
  id: string
): Promise<EmployeesRepositoryResult<void>> {
  const payload = { deleted_at: new Date().toISOString() }
  const requestUrl = buildEmployeeSoftDeleteRequestUrl(id)

  logEmployeeSoftDeleteAttempt({
    employeeId: id,
    payload,
    requestUrl,
  })

  const { data, error } = await client
    .from("employees")
    .update(payload)
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle()

  logEmployeeSoftDeleteResult({
    employeeId: id,
    data,
    error,
  })

  if (error) {
    return { data: null, error: mapSupabaseEmployeeError(error) }
  }

  if (!data) {
    return {
      data: null,
      error: {
        code: "NOT_FOUND",
        message: "Empleado no encontrado o ya fue eliminado.",
      },
    }
  }

  return { data: undefined, error: null }
}
