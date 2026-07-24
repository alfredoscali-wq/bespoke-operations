import "server-only"

import type { User } from "@supabase/supabase-js"

import {
  assertAuthEmailMatchesEmployeeDni,
  buildAuthEmail,
  normalizeDni,
} from "@/lib/auth/auth-identity"
import {
  findAuthUserByDni,
  findAuthUserById,
} from "@/lib/auth/auth-user-lookup"
import { createAdminClient, type SupabaseAdminClient } from "@/lib/supabase/admin"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import {
  fetchEmployeeById,
  patchEmployee,
} from "@/lib/supabase/employees.queries"
import type { Employee } from "@/lib/types/employees"

export type AuthProvisioningResult =
  | {
      success: true
      authUserId: string
      reused: boolean
      created: boolean
    }
  | { success: false; error: string }

function logProvision(
  level: "info" | "warn" | "error",
  message: string,
  details?: Record<string, unknown>
) {
  const payload = {
    scope: "auth-provisioning",
    message,
    ...details,
  }
  if (level === "error") {
    console.error("[auth-provisioning]", payload)
  } else if (level === "warn") {
    console.warn("[auth-provisioning]", payload)
  } else {
    console.info("[auth-provisioning]", payload)
  }
}

function resolveEmployeeDisplayName(employee: Employee): string {
  const preferred = employee.preferredName?.trim()
  if (preferred) return preferred
  return `${employee.firstName} ${employee.lastName}`.trim() || employee.id
}

async function fetchEmployeeCompanyId(
  admin: SupabaseAdminClient,
  employeeId: string
): Promise<string | null> {
  const { data, error } = await admin
    .from("employees")
    .select("company_id")
    .eq("id", employeeId)
    .is("deleted_at", null)
    .maybeSingle()

  if (error || !data) return null
  return data.company_id
}

/**
 * Auth ↔ employee link integrity.
 *
 * DB already enforces: at most ONE active employee per app_user_id
 * (unique index employees_app_user_id_unique WHERE deleted_at IS NULL).
 *
 * When provisioning reuses an Auth user that is still linked to another
 * *active* employee row (same person, e.g. contractor Field Agent →
 * internal employee), we must transfer the link or the INSERT/UPDATE
 * would fail the unique index.
 *
 * Rules:
 * - Same normalized DNI → same person → transfer is allowed (normal lifecycle).
 * - Different DNI → integrity failure → refuse (never steal another person's Auth).
 * - Soft-deleted rows are ignored (they may keep historical app_user_id).
 */
async function transferAuthLinkIfNeeded(
  admin: SupabaseAdminClient,
  authUserId: string,
  targetEmployeeId: string,
  targetNormalizedDni: string
): Promise<void> {
  const { data, error } = await admin
    .from("employees")
    .select("id, national_id, contractor_id")
    .eq("app_user_id", authUserId)
    .is("deleted_at", null)
    .neq("id", targetEmployeeId)

  if (error) {
    throw new Error(
      `[auth-provisioning] No se pudo validar vínculos app_user_id: ${error.message}`
    )
  }

  for (const row of data ?? []) {
    const otherDni = row.national_id ? normalizeDni(row.national_id) : ""

    if (otherDni && otherDni !== targetNormalizedDni) {
      logProvision("error", "Auth identity collision across different DNIs", {
        authUserId,
        targetEmployeeId,
        targetDni: targetNormalizedDni,
        otherEmployeeId: row.id,
        otherDni,
      })
      throw new Error(
        "Integridad de identidad: el usuario Auth ya está vinculado a otro empleado activo con distinto DNI. No se puede reutilizar."
      )
    }

    logProvision("info", "Transferring Auth identity to new employment record", {
      authUserId,
      fromEmployeeId: row.id,
      toEmployeeId: targetEmployeeId,
      dni: targetNormalizedDni,
      fromContractorId: row.contractor_id,
      reason:
        "same_person_new_employment_row_required_by_app_user_id_unique_index",
    })

    const patch = await patchEmployee(admin, row.id, {
      appUserId: null,
      // Previous employment relationship loses login until re-provisioned.
      systemAccess: false,
      mustChangePassword: false,
    })
    if (patch.error) {
      throw new Error(
        patch.error.message ??
          "No se pudo transferir app_user_id desde el registro laboral anterior."
      )
    }
  }
}

async function linkEmployeeToAuthUser(
  admin: SupabaseAdminClient,
  employeeId: string,
  authUserId: string,
  normalizedDni: string
): Promise<Employee> {
  await transferAuthLinkIfNeeded(admin, authUserId, employeeId, normalizedDni)

  const patchResult = await patchEmployee(admin, employeeId, {
    appUserId: authUserId,
    mustChangePassword: true,
    systemAccess: true,
  })

  if (patchResult.error || !patchResult.data) {
    throw new Error(
      patchResult.error?.message ??
        "No se pudo vincular app_user_id al empleado."
    )
  }

  return patchResult.data
}

async function unbanAuthUserIfNeeded(
  admin: SupabaseAdminClient,
  authUserId: string
): Promise<void> {
  const { error } = await admin.auth.admin.updateUserById(authUserId, {
    ban_duration: "none",
  })
  if (error) {
    logProvision("warn", "Could not clear Auth ban (continuing)", {
      authUserId,
      error: error.message,
    })
  }
}

async function createAuthUserForEmployee(input: {
  admin: SupabaseAdminClient
  employee: Employee
  normalizedDni: string
  companyId: string
}): Promise<User> {
  const email = buildAuthEmail(input.normalizedDni, input.companyId)

  logProvision("info", "Creating Auth user", {
    employeeId: input.employee.id,
    email,
  })

  const { data, error } = await input.admin.auth.admin.createUser({
    email,
    password: input.normalizedDni,
    email_confirm: true,
    user_metadata: {
      employee_id: input.employee.id,
      national_id: input.normalizedDni,
      system_role: input.employee.systemRole,
      company_id: input.companyId,
      contractor_id: input.employee.contractorId ?? null,
      display_name: resolveEmployeeDisplayName(input.employee),
      must_change_password: true,
    },
  })

  if (error) {
    // Race: another request created the same identity — recover by lookup.
    const recovered = await findAuthUserByDni(input.admin, input.normalizedDni)
    if (recovered) {
      logProvision("info", "Create collided; recovered existing Auth user", {
        employeeId: input.employee.id,
        authUserId: recovered.id,
      })
      return recovered
    }

    throw new Error(error.message)
  }

  const user = data.user
  if (!user?.id) {
    throw new Error("No se pudo crear el usuario Auth.")
  }

  const consistency = assertAuthEmailMatchesEmployeeDni({
    authEmail: user.email,
    nationalId: input.normalizedDni,
    expectedAuthEmail: email,
  })

  if (!consistency.ok) {
    await input.admin.auth.admin.deleteUser(user.id)
    throw new Error(consistency.error)
  }

  return user
}

/**
 * Unified Auth identity provisioning for employment records (internal or contractor).
 *
 * Model:
 * - Person identity = DNI → at most one Auth user
 * - Employment record = employees row (contractor_id null | set)
 * - Active employees.app_user_id is unique (DB); login binds to the active linked row
 *
 * Idempotent: repeated "Crear acceso" on the same employee always succeeds.
 * Future subjects (providers, external supervisors, customers) should resolve
 * the same Auth user via findAuthUserByDni + metadata, then bind their own
 * subject table — without changing Auth creation rules.
 */
export async function provisionAuthIdentityForEmployee(
  employeeId: string
): Promise<AuthProvisioningResult> {
  const trimmedId = employeeId.trim()

  if (!trimmedId) {
    return { success: false, error: "employeeId es obligatorio." }
  }

  const admin = createAdminClient()

  try {
    const employeeResult = await fetchEmployeeById(admin, trimmedId)
    if (employeeResult.error || !employeeResult.data) {
      return {
        success: false,
        error: employeeResult.error?.message ?? "Empleado no encontrado.",
      }
    }

    const employee = employeeResult.data

    if (!employee.systemAccess) {
      return {
        success: false,
        error:
          "El empleado no tiene acceso al sistema habilitado (system_access = false).",
      }
    }

    const nationalId = employee.nationalId?.trim()
    const normalizedDni = nationalId ? normalizeDni(nationalId) : ""
    if (!normalizedDni) {
      return {
        success: false,
        error:
          "El empleado no tiene DNI registrado. Complete el DNI en RRHH antes de provisionar.",
      }
    }

    const companyId =
      (await fetchEmployeeCompanyId(admin, trimmedId)) ??
      employee.companyId ??
      BESPOKE_PRODUCTION_COMPANY_ID

    logProvision("info", "Provision start", {
      employeeId: trimmedId,
      dni: normalizedDni,
      companyId,
      existingAppUserId: employee.appUserId ?? null,
      contractorId: employee.contractorId ?? null,
    })

    // Path A — already linked: sync only (fully idempotent).
    if (employee.appUserId) {
      const linked = await findAuthUserById(admin, employee.appUserId)
      if (linked) {
        await unbanAuthUserIfNeeded(admin, linked.id)
        await syncProvisionedMetadata(trimmedId)
        logProvision("info", "Provision idempotent (already linked)", {
          employeeId: trimmedId,
          authUserId: linked.id,
        })
        return {
          success: true,
          authUserId: linked.id,
          reused: true,
          created: false,
        }
      }

      logProvision("warn", "Stale app_user_id; will re-resolve by DNI", {
        employeeId: trimmedId,
        staleAppUserId: employee.appUserId,
      })
    }

    // Path B — find existing Auth identity by DNI (any email suffix / metadata).
    let authUser = await findAuthUserByDni(admin, normalizedDni)
    let created = false

    if (authUser) {
      logProvision("info", "Reusing existing Auth identity", {
        employeeId: trimmedId,
        authUserId: authUser.id,
        authEmail: authUser.email ?? null,
      })
      await unbanAuthUserIfNeeded(admin, authUser.id)
    } else {
      authUser = await createAuthUserForEmployee({
        admin,
        employee,
        normalizedDni,
        companyId,
      })
      created = true
    }

    await linkEmployeeToAuthUser(admin, trimmedId, authUser.id, normalizedDni)
    await syncProvisionedMetadata(trimmedId)

    logProvision("info", "Provision complete", {
      employeeId: trimmedId,
      authUserId: authUser.id,
      created,
      reused: !created,
    })

    return {
      success: true,
      authUserId: authUser.id,
      reused: !created,
      created,
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo provisionar el acceso."
    logProvision("error", "Provision failed", {
      employeeId: trimmedId,
      error: message,
    })
    return { success: false, error: message }
  }
}

async function syncProvisionedMetadata(employeeId: string) {
  const { syncEmployeeAuthMetadata } = await import(
    "@/lib/auth/sync-employee-auth-metadata"
  )
  const result = await syncEmployeeAuthMetadata(employeeId)
  if (!result.success) {
    logProvision("warn", "Metadata sync failed after provision", {
      employeeId,
      error: result.error,
    })
  }
}

/** @deprecated Prefer provisionAuthIdentityForEmployee — kept for call-site compatibility. */
export async function provisionEmployeeAccess(
  employeeId: string
): Promise<
  | { success: true; authUserId: string }
  | { success: false; error: string }
> {
  const result = await provisionAuthIdentityForEmployee(employeeId)
  if (!result.success) {
    return { success: false, error: result.error }
  }
  return { success: true, authUserId: result.authUserId }
}
