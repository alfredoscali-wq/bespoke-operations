import type {
  EmployeeImportExecutionResult,
  EmployeeImportFailureDetail,
  EmployeeImportReviewRow,
} from "@/lib/employees/employee-import/types"
import type {
  Employee,
  NewEmployeeInput,
  UpdateEmployeeInput,
} from "@/lib/types/employees"

type EmployeeMutationResult = {
  success: boolean
  message?: string
  employee?: Employee
}

function hasAuthFields(payload: NewEmployeeInput): boolean {
  return (
    payload.systemAccess !== undefined ||
    payload.systemRole !== undefined ||
    payload.mustChangePassword !== undefined
  )
}

function buildAuthUpdate(payload: NewEmployeeInput): UpdateEmployeeInput {
  return {
    systemAccess: payload.systemAccess,
    systemRole: payload.systemRole,
    mustChangePassword: payload.mustChangePassword ?? false,
  }
}

export async function executeEmployeeImport(input: {
  rows: EmployeeImportReviewRow[]
  addEmployee: (payload: NewEmployeeInput) => Promise<EmployeeMutationResult>
  editEmployee: (
    id: string,
    payload: UpdateEmployeeInput
  ) => Promise<EmployeeMutationResult>
}): Promise<EmployeeImportExecutionResult> {
  const { rows, addEmployee, editEmployee } = input

  const failures: EmployeeImportFailureDetail[] = []
  let created = 0
  let failed = 0
  let skipped = 0

  for (const row of rows) {
    if (row.status === "error" || !row.payload) {
      skipped += 1
      failures.push({
        rowNumber: row.rowNumber,
        message:
          row.issues[0]?.message ?? "Fila omitida por errores de validación",
      })
      continue
    }

    try {
      const createResult = await addEmployee(row.payload)

      if (!createResult.success || !createResult.employee) {
        failed += 1
        failures.push({
          rowNumber: row.rowNumber,
          message:
            createResult.message ?? "No se pudo registrar al empleado",
        })
        continue
      }

      if (hasAuthFields(row.payload)) {
        const authResult = await editEmployee(
          createResult.employee.id,
          buildAuthUpdate(row.payload)
        )

        if (!authResult.success) {
          failed += 1
          failures.push({
            rowNumber: row.rowNumber,
            message:
              authResult.message ??
              "Empleado creado pero no se pudo actualizar el acceso al sistema",
          })
          continue
        }
      }

      created += 1
    } catch (error) {
      failed += 1
      failures.push({
        rowNumber: row.rowNumber,
        message:
          error instanceof Error ? error.message : "Error inesperado al importar",
      })
    }
  }

  return {
    total: rows.length,
    created,
    failed,
    skipped,
    failures,
  }
}
