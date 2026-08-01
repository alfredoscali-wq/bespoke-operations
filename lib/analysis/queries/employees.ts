/**
 * Lean employees fetch for Análisis screens (Sprint 16).
 * Replaces listEmployees(`*`) for Sala / Workforce / Jornada.
 */

import { createClient } from "@/lib/supabase/client"
import { ANALYSIS_EMPLOYEE_SELECT } from "@/lib/analysis/queries/selects"
import type { Employee, SystemRole } from "@/lib/types/employees"

export type AnalysisEmployee = Pick<
  Employee,
  | "id"
  | "firstName"
  | "lastName"
  | "preferredName"
  | "department"
  | "systemRole"
>

type AnalysisEmployeeRow = {
  id: string
  first_name: string
  last_name: string
  preferred_name: string | null
  department: string
  system_role: SystemRole
}

function mapRow(row: AnalysisEmployeeRow): AnalysisEmployee {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    preferredName: row.preferred_name ?? undefined,
    department: row.department,
    systemRole: row.system_role,
  }
}

/**
 * Directory subset used by Análisis UI (names, area, role).
 * No SELECT *, no employee_types join.
 */
export async function listAnalysisEmployees(companyId: string): Promise<{
  data: AnalysisEmployee[] | null
  error: { message: string } | null
}> {
  const client = createClient()
  const { data, error } = await client
    .from("employees")
    .select(ANALYSIS_EMPLOYEE_SELECT)
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })

  if (error) {
    return { data: null, error: { message: error.message } }
  }

  return {
    data: ((data ?? []) as unknown as AnalysisEmployeeRow[]).map(mapRow),
    error: null,
  }
}
