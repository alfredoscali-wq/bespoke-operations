import "server-only"

import {
  buildAuthEmail,
  normalizeDni,
} from "@/lib/auth/auth-identity"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  fetchEmployeeById,
  patchEmployee,
} from "@/lib/supabase/employees.queries"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import type { Employee } from "@/lib/types/employees"

export type ProvisionEmployeeAccessResult =
  | { success: true; authUserId: string }
  | { success: false; error: string }

export type DisableEmployeeAccessResult =
  | { success: true }
  | { success: false; error: string }

function resolveAuthUserAlreadyExistsMessage(): string {
  return "Ya existe un usuario Auth para este DNI. Revise Auth o vincule manualmente el app_user_id."
}

function mapAuthCreateUserError(message: string): string {
  const normalized = message.toLowerCase()

  if (
    normalized.includes("already been registered") ||
    normalized.includes("already exists") ||
    normalized.includes("duplicate")
  ) {
    return resolveAuthUserAlreadyExistsMessage()
  }

  return message
}

async function fetchEmployeeCompanyId(
  employeeId: string
): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("employees")
    .select("company_id")
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return data.company_id
}

function validateEmployeeForProvisioning(
  employee: Employee
): ProvisionEmployeeAccessResult | null {
  if (!employee.systemAccess) {
    return {
      success: false,
      error: "El empleado no tiene acceso al sistema habilitado (system_access = false).",
    }
  }

  const nationalId = employee.nationalId?.trim()
  if (!nationalId || !normalizeDni(nationalId)) {
    return {
      success: false,
      error: "El empleado no tiene DNI registrado. Complete el DNI en RRHH antes de provisionar.",
    }
  }

  if (employee.appUserId) {
    return {
      success: false,
      error: "El empleado ya tiene un usuario vinculado (app_user_id).",
    }
  }

  return null
}

export async function provisionEmployeeAccess(
  employeeId: string
): Promise<ProvisionEmployeeAccessResult> {
  const trimmedId = employeeId.trim()

  if (!trimmedId) {
    return {
      success: false,
      error: "employeeId es obligatorio.",
    }
  }

  const admin = createAdminClient()

  const employeeResult = await fetchEmployeeById(admin, trimmedId)

  if (employeeResult.error || !employeeResult.data) {
    return {
      success: false,
      error: employeeResult.error?.message ?? "Empleado no encontrado.",
    }
  }

  const employee = employeeResult.data
  const validationError = validateEmployeeForProvisioning(employee)

  if (validationError) {
    return validationError
  }

  const nationalId = employee.nationalId!.trim()
  const normalizedDni = normalizeDni(nationalId)
  const companyId =
    (await fetchEmployeeCompanyId(trimmedId)) ?? BESPOKE_PRODUCTION_COMPANY_ID
  const email = buildAuthEmail(normalizedDni, companyId)

  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email,
      password: normalizedDni,
      email_confirm: true,
      user_metadata: {
        employee_id: employee.id,
        national_id: normalizedDni,
        system_role: employee.systemRole,
      },
    })

  if (authError) {
    return {
      success: false,
      error: mapAuthCreateUserError(authError.message),
    }
  }

  const authUserId = authData.user?.id

  if (!authUserId) {
    return {
      success: false,
      error: "No se pudo crear el usuario Auth.",
    }
  }

  const patchResult = await patchEmployee(admin, trimmedId, {
    appUserId: authUserId,
    mustChangePassword: true,
  })

  if (patchResult.error || !patchResult.data) {
    await admin.auth.admin.deleteUser(authUserId)

    return {
      success: false,
      error:
        patchResult.error?.message ??
        "No se pudo vincular el usuario al empleado. Se revirtió la creación en Auth.",
    }
  }

  return {
    success: true,
    authUserId,
  }
}

export async function disableEmployeeAccess(
  employeeId: string
): Promise<DisableEmployeeAccessResult> {
  const trimmedId = employeeId.trim()

  if (!trimmedId) {
    return {
      success: false,
      error: "employeeId es obligatorio.",
    }
  }

  const admin = createAdminClient()
  const employeeResult = await fetchEmployeeById(admin, trimmedId)

  if (employeeResult.error || !employeeResult.data) {
    return {
      success: false,
      error: employeeResult.error?.message ?? "Empleado no encontrado.",
    }
  }

  const employee = employeeResult.data

  if (!employee.appUserId) {
    return {
      success: false,
      error: "El empleado no tiene un usuario Auth vinculado.",
    }
  }

  const authUserId = employee.appUserId

  const { error: deleteError } = await admin.auth.admin.deleteUser(authUserId)

  if (deleteError) {
    return {
      success: false,
      error: mapAuthCreateUserError(deleteError.message),
    }
  }

  const patchResult = await patchEmployee(admin, trimmedId, {
    appUserId: null,
    mustChangePassword: false,
  })

  if (patchResult.error) {
    return {
      success: false,
      error:
        patchResult.error.message ??
        "El usuario Auth fue eliminado pero no se pudo limpiar app_user_id en RRHH.",
    }
  }

  return { success: true }
}
