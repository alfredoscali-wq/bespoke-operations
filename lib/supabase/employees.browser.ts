import { createClient } from "@/lib/supabase/client"
import {
  createDiagnosticEmployeesClient,
  logDeleteEmployeeEnd,
  logDeleteEmployeeStart,
  logEmployeeDeleteClientDiagnostics,
} from "@/lib/supabase/employees-delete-diagnostics"
import {
  fetchEmployeeByAppUserId,
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

export function createBrowserEmployeesClient(): SupabaseEmployeesClient {
  return createClient()
}

export async function listEmployees(
  client: SupabaseEmployeesClient = createBrowserEmployeesClient()
): Promise<EmployeesRepositoryResult<Employee[]>> {
  return fetchEmployees(client)
}

export async function getEmployeeById(
  id: string,
  client: SupabaseEmployeesClient = createBrowserEmployeesClient()
): Promise<EmployeesRepositoryResult<Employee>> {
  return fetchEmployeeById(client, id)
}

export async function getEmployeeByAppUserId(
  appUserId: string,
  client: SupabaseEmployeesClient = createBrowserEmployeesClient()
): Promise<EmployeesRepositoryResult<Employee>> {
  return fetchEmployeeByAppUserId(client, appUserId)
}

export async function getEmployeeByCode(
  employeeCode: string,
  companyId?: string,
  client: SupabaseEmployeesClient = createBrowserEmployeesClient()
): Promise<EmployeesRepositoryResult<Employee>> {
  return fetchEmployeeByCode(client, employeeCode, companyId)
}

export async function createEmployee(
  payload: CreateEmployeePayload,
  client: SupabaseEmployeesClient = createBrowserEmployeesClient()
): Promise<EmployeesRepositoryResult<Employee>> {
  return insertEmployee(client, payload)
}

export async function updateEmployee(
  id: string,
  payload: UpdateEmployeePayload,
  client: SupabaseEmployeesClient = createBrowserEmployeesClient()
): Promise<EmployeesRepositoryResult<Employee>> {
  return patchEmployee(client, id, payload)
}

export async function deleteEmployee(
  id: string,
  client: SupabaseEmployeesClient = createBrowserEmployeesClient()
): Promise<EmployeesRepositoryResult<void>> {
  logDeleteEmployeeStart(id)

  await logEmployeeDeleteClientDiagnostics(
    client,
    id,
    "deleteEmployee() incoming client"
  )

  const diagnosticClient = createDiagnosticEmployeesClient()
  await logEmployeeDeleteClientDiagnostics(
    diagnosticClient,
    id,
    "deleteEmployee() diagnostic client"
  )

  const result = await softDeleteEmployee(diagnosticClient, id)

  logDeleteEmployeeEnd(result)
  return result
}

export {
  fetchEmployeeByCode,
  fetchEmployeeById,
  fetchEmployees,
  insertEmployee,
  patchEmployee,
  softDeleteEmployee,
} from "@/lib/supabase/employees.queries"
