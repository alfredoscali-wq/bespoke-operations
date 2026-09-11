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

function toDirectoryInsertPayload(payload: NewEmployeeInput): NewEmployeeInput {
  return {
    employeeCode: payload.employeeCode,
    firstName: payload.firstName,
    lastName: payload.lastName,
    preferredName: payload.preferredName,
    nationalId: payload.nationalId,
    birthDate: payload.birthDate,
    email: payload.email,
    phone: payload.phone,
    jobTitle: payload.jobTitle,
    department: payload.department,
    employeeType: payload.employeeType,
    employeeTypeId: payload.employeeTypeId,
    employmentStatus: payload.employmentStatus,
    hireDate: payload.hireDate,
    terminationDate: payload.terminationDate,
    notes: payload.notes,
    contractorId: payload.contractorId,
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
  const { rows, addEmployee } = input
  // Privileged Auth columns are not written from import; keep the dialog signature.

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
      const createResult = await addEmployee(toDirectoryInsertPayload(row.payload))

      if (!createResult.success || !createResult.employee) {
        failed += 1
        failures.push({
          rowNumber: row.rowNumber,
          message:
            createResult.message ?? "No se pudo registrar al empleado",
        })
        continue
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
