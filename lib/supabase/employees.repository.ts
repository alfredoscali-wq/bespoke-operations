import { createClient } from "@/lib/supabase/server"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import {
  fetchEmployeeByCode,
  fetchEmployeeById,
  fetchEmployees,
  insertEmployee,
  patchEmployee,
  softDeleteEmployee,
  type SupabaseEmployeesClient,
} from "@/lib/supabase/employees.queries"
import type { Employee } from "@/lib/types/employees"
import type {
  CreateEmployeePayload,
  EmployeesRepositoryResult,
  UpdateEmployeePayload,
} from "@/lib/types/supabase/employees"

async function createServerEmployeesClient(): Promise<SupabaseEmployeesClient> {
  return createClient()
}

export async function listEmployees(
  companyId: string = BESPOKE_PRODUCTION_COMPANY_ID,
  client?: SupabaseEmployeesClient
): Promise<EmployeesRepositoryResult<Employee[]>> {
  return fetchEmployees(client ?? (await createServerEmployeesClient()), companyId)
}

export async function getEmployeeById(
  id: string,
  client?: SupabaseEmployeesClient
): Promise<EmployeesRepositoryResult<Employee>> {
  return fetchEmployeeById(client ?? (await createServerEmployeesClient()), id)
}

export async function getEmployeeByCode(
  employeeCode: string,
  companyId?: string,
  client?: SupabaseEmployeesClient
): Promise<EmployeesRepositoryResult<Employee>> {
  return fetchEmployeeByCode(
    client ?? (await createServerEmployeesClient()),
    employeeCode,
    companyId
  )
}

export async function createEmployee(
  payload: CreateEmployeePayload,
  client?: SupabaseEmployeesClient
): Promise<EmployeesRepositoryResult<Employee>> {
  return insertEmployee(client ?? (await createServerEmployeesClient()), payload)
}

export async function updateEmployee(
  id: string,
  payload: UpdateEmployeePayload,
  client?: SupabaseEmployeesClient
): Promise<EmployeesRepositoryResult<Employee>> {
  return patchEmployee(
    client ?? (await createServerEmployeesClient()),
    id,
    payload
  )
}

export async function deleteEmployee(
  id: string,
  client?: SupabaseEmployeesClient
): Promise<EmployeesRepositoryResult<void>> {
  return softDeleteEmployee(client ?? (await createServerEmployeesClient()), id)
}

export { createBrowserEmployeesClient } from "@/lib/supabase/employees.browser"
