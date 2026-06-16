"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"

import { BESPOKE_DEMO_COMPANY_ID } from "@/lib/supabase/company.constants"
import {
  logEmployeeDeleteClientDiagnostics,
  logRemoveEmployeeEnd,
  logRemoveEmployeeStart,
} from "@/lib/supabase/employees-delete-diagnostics"
import {
  createBrowserEmployeesClient,
  createEmployee,
  deleteEmployee,
  listEmployees,
  updateEmployee,
} from "@/lib/supabase/employees.browser"
import type {
  Employee,
  NewEmployeeInput,
  UpdateEmployeeInput,
} from "@/lib/types/employees"

type EmployeeMutationResult = {
  success: boolean
  message?: string
}

type EmployeesContextValue = {
  employees: Employee[]
  isEmployeesReady: boolean
  usesSupabase: boolean
  getEmployee: (id: string) => Employee | undefined
  getEmployeeByCode: (code: string) => Employee | undefined
  addEmployee: (
    input: NewEmployeeInput
  ) => Promise<EmployeeMutationResult & { employee?: Employee }>
  editEmployee: (
    id: string,
    input: UpdateEmployeeInput
  ) => Promise<EmployeeMutationResult & { employee?: Employee }>
  removeEmployee: (id: string) => Promise<EmployeeMutationResult>
}

const EmployeesContext = createContext<EmployeesContextValue | null>(null)

function replaceEmployeeInList(
  employees: Employee[],
  employee: Employee
): Employee[] {
  return employees.map((item) => (item.id === employee.id ? employee : item))
}

function sortEmployees(employees: Employee[]): Employee[] {
  return [...employees].sort((a, b) => {
    const lastNameCompare = a.lastName.localeCompare(b.lastName, "es")
    if (lastNameCompare !== 0) return lastNameCompare
    return a.firstName.localeCompare(b.firstName, "es")
  })
}

export function EmployeesProvider({ children }: { children: React.ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isEmployeesReady, setIsEmployeesReady] = useState(false)
  const [usesSupabase, setUsesSupabase] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadEmployeesFromSupabase() {
      try {
        const client = createBrowserEmployeesClient()
        const result = await listEmployees(client)

        if (cancelled) return

        if (result.error || result.data === null) {
          setEmployees([])
          setUsesSupabase(false)
          return
        }

        setEmployees(result.data)
        setUsesSupabase(true)
      } catch {
        if (!cancelled) {
          setEmployees([])
          setUsesSupabase(false)
        }
      } finally {
        if (!cancelled) {
          setIsEmployeesReady(true)
        }
      }
    }

    void loadEmployeesFromSupabase()

    return () => {
      cancelled = true
    }
  }, [])

  const getEmployee = useCallback(
    (id: string) => employees.find((employee) => employee.id === id),
    [employees]
  )

  const getEmployeeByCode = useCallback(
    (code: string) => {
      const normalized = code.trim().toLowerCase()
      return employees.find(
        (employee) => employee.employeeCode.toLowerCase() === normalized
      )
    },
    [employees]
  )

  const addEmployee = useCallback(
    async (input: NewEmployeeInput) => {
      if (!usesSupabase) {
        return {
          success: false,
          message:
            "Supabase no está disponible. No se pudo registrar al empleado.",
        }
      }

      try {
        const client = createBrowserEmployeesClient()
        const result = await createEmployee(
          {
            companyId: BESPOKE_DEMO_COMPANY_ID,
            employeeCode: input.employeeCode,
            firstName: input.firstName,
            lastName: input.lastName,
            preferredName: input.preferredName ?? null,
            nationalId: input.nationalId ?? null,
            birthDate: input.birthDate ?? null,
            email: input.email ?? null,
            phone: input.phone ?? null,
            jobTitle: input.jobTitle,
            department: input.department,
            employmentStatus: input.employmentStatus ?? "active",
            hireDate: input.hireDate ?? null,
            terminationDate: input.terminationDate ?? null,
            notes: input.notes,
            appUserId: input.appUserId ?? null,
          },
          client
        )

        if (result.data) {
          setEmployees((current) => sortEmployees([...current, result.data!]))
          return { success: true, employee: result.data }
        }

        return {
          success: false,
          message: result.error?.message ?? "No se pudo registrar al empleado.",
        }
      } catch {
        return {
          success: false,
          message: "No se pudo registrar al empleado.",
        }
      }
    },
    [usesSupabase]
  )

  const editEmployee = useCallback(
    async (id: string, input: UpdateEmployeeInput) => {
      if (!usesSupabase) {
        return {
          success: false,
          message:
            "Supabase no está disponible. No se pudo actualizar al empleado.",
        }
      }

      try {
        const client = createBrowserEmployeesClient()
        const result = await updateEmployee(id, input, client)

        if (result.data) {
          setEmployees((current) =>
            sortEmployees(replaceEmployeeInList(current, result.data!))
          )
          return { success: true, employee: result.data }
        }

        return {
          success: false,
          message:
            result.error?.message ?? "No se pudo actualizar al empleado.",
        }
      } catch {
        return {
          success: false,
          message: "No se pudo actualizar al empleado.",
        }
      }
    },
    [usesSupabase]
  )

  const removeEmployee = useCallback(
    async (id: string) => {
      if (!usesSupabase) {
        return {
          success: false,
          message:
            "Supabase no está disponible. No se pudo eliminar al empleado.",
        }
      }

      try {
        logRemoveEmployeeStart(id)

        const client = createBrowserEmployeesClient()
        await logEmployeeDeleteClientDiagnostics(
          client,
          id,
          "removeEmployee() provider client"
        )

        const result = await deleteEmployee(id, client)

        if (result.error) {
          const failure = {
            success: false as const,
            message: result.error.message ?? "No se pudo eliminar al empleado.",
          }
          logRemoveEmployeeEnd(failure)
          return failure
        }

        setEmployees((current) =>
          current.filter((employee) => employee.id !== id)
        )
        const success = { success: true as const }
        logRemoveEmployeeEnd(success)
        return success
      } catch (error) {
        console.error("[RRHH DIAG] removeEmployee() unexpected error", error)
        const failure = {
          success: false as const,
          message: "No se pudo eliminar al empleado.",
        }
        logRemoveEmployeeEnd(failure)
        return failure
      }
    },
    [usesSupabase]
  )

  const value = useMemo(
    () => ({
      employees,
      isEmployeesReady,
      usesSupabase,
      getEmployee,
      getEmployeeByCode,
      addEmployee,
      editEmployee,
      removeEmployee,
    }),
    [
      employees,
      isEmployeesReady,
      usesSupabase,
      getEmployee,
      getEmployeeByCode,
      addEmployee,
      editEmployee,
      removeEmployee,
    ]
  )

  return (
    <EmployeesContext.Provider value={value}>{children}</EmployeesContext.Provider>
  )
}

export function useEmployees() {
  const context = useContext(EmployeesContext)
  if (!context) {
    throw new Error("useEmployees debe usarse dentro de EmployeesProvider.")
  }
  return context
}
