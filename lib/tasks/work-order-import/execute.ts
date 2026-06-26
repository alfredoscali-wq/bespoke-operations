import { taskDefaultChecklist } from "@/components/tareas/task-form-dialog"
import { resolveCrewSnapshotsForAssignment } from "@/lib/tasks/crew-relation"
import {
  buildWorkOrderCreatePayload,
  getDefaultWorkOrderForm,
  isNewInstallationWorkOrder,
  requiresCustomerLookup,
  type WorkOrderFormInput,
} from "@/lib/tasks/work-order"
import { resolveSupervisorFromCrew } from "@/lib/tasks/utils"
import type {
  WorkOrderImportExecutionResult,
  WorkOrderImportReportRow,
  WorkOrderImportReviewRow,
} from "@/lib/tasks/work-order-import/types"
import type { Customer, NewCustomerInput } from "@/lib/types/customers"
import type { Crew } from "@/lib/types/crews"
import type { CreateTaskPayload } from "@/lib/types/supabase/tasks"
import type { Task } from "@/lib/types/tasks"

type CustomerMutationResult = {
  success: boolean
  message?: string
  customer?: Customer
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function findCustomerMatch(
  customers: Customer[],
  name: string,
  phone?: string
): Customer | undefined {
  const normalizedName = normalizeKey(name)
  if (!normalizedName) return undefined

  const exact = customers.find(
    (customer) => normalizeKey(customer.name) === normalizedName
  )
  if (exact) return exact

  if (phone?.trim()) {
    const phoneMatch = customers.find(
      (customer) => customer.phone?.trim() === phone.trim()
    )
    if (phoneMatch) return phoneMatch
  }

  return customers.find((customer) =>
    normalizeKey(customer.name).includes(normalizedName)
  )
}

function importRowToFormInput(row: WorkOrderImportReviewRow): WorkOrderFormInput {
  const { data } = row

  return {
    ...getDefaultWorkOrderForm(),
    serviceType: data.serviceType,
    customerName: data.customerName,
    customerPhone: data.customerPhone,
    customerEmail: data.customerEmail,
    customerId: data.customerId,
    scheduledDate: data.scheduledDate,
    scheduledTime: "",
    crewId: data.crewId,
    observations: data.observations,
    address: data.address,
    locality: data.locality,
    technology: data.technology,
    currentAddress: data.currentAddress,
    newAddress: data.newAddress,
    currentLocality: data.currentLocality,
    newLocality: data.newLocality,
    currentTechnology: data.currentTechnology,
    newTechnology: data.newTechnology,
    serviceReason: (data.serviceReason ||
      "sin-conexion") as WorkOrderFormInput["serviceReason"],
    serviceDetail: data.serviceDetail,
    cancellationReason: data.cancellationReason,
    equipmentToRemove: data.equipmentToRemove,
    surveyReason: data.surveyReason,
    postventaDetail: data.postventaDetail,
    customerCompany: data.customerCompany,
    externalReference: data.externalReference,
    clientOrderNumber: data.clientOrderNumber,
    province: data.province,
    postalCode: data.postalCode,
  }
}

function buildReportRow(
  row: WorkOrderImportReviewRow,
  resultado: string,
  error = "",
  sugerencia = ""
): WorkOrderImportReportRow {
  return {
    fila: row.rowNumber,
    resultado,
    error,
    sugerencia,
  }
}

export async function executeWorkOrderImport(input: {
  rows: WorkOrderImportReviewRow[]
  existingTasks: Task[]
  customers: Customer[]
  crews: Crew[]
  createCustomer: (payload: NewCustomerInput) => Promise<CustomerMutationResult>
  addTask: (payload: CreateTaskPayload) => Promise<Task>
}): Promise<WorkOrderImportExecutionResult> {
  const { rows, existingTasks, createCustomer, addTask, crews } = input
  let customers = [...input.customers]
  let workingTasks = [...existingTasks]

  const reportRows: WorkOrderImportReportRow[] = []
  let imported = 0
  let importedWithWarnings = 0
  let excluded = 0
  let failed = 0

  for (const row of rows) {
    if (!row.selected) {
      excluded += 1
      reportRows.push(
        buildReportRow(row, "Excluida", "", "Fila desmarcada por el usuario")
      )
      continue
    }

    if (row.status === "error") {
      excluded += 1
      const primaryIssue = row.issues.find((issue) => issue.level === "error")
      reportRows.push(
        buildReportRow(
          row,
          "Excluida",
          primaryIssue?.message ?? "Error de validación",
          primaryIssue?.suggestion ?? ""
        )
      )
      continue
    }

    try {
      let customerId = row.data.customerId

      if (isNewInstallationWorkOrder(row.data.serviceType)) {
        const customerResult = await createCustomer({
          name: row.data.customerName.trim(),
          phone: row.data.customerPhone.trim() || undefined,
          email: row.data.customerEmail.trim() || undefined,
          address: row.data.address.trim() || undefined,
          locality: row.data.locality.trim() || undefined,
          technology: row.data.technology || undefined,
        })

        if (!customerResult.success || !customerResult.customer) {
          failed += 1
          reportRows.push(
            buildReportRow(
              row,
              "Error",
              customerResult.message ?? "No se pudo crear el cliente",
              "Revise los datos del cliente e intente nuevamente"
            )
          )
          continue
        }

        customerId = customerResult.customer.id
        customers = [...customers, customerResult.customer]
      } else if (requiresCustomerLookup(row.data.serviceType)) {
        const customer = findCustomerMatch(
          customers,
          row.data.customerName,
          row.data.customerPhone
        )

        if (!customer) {
          failed += 1
          reportRows.push(
            buildReportRow(
              row,
              "Error",
              "Cliente no encontrado en la base",
              "Registre al cliente antes de importar este tipo de orden"
            )
          )
          continue
        }

        customerId = customer.id
      }

      const form = importRowToFormInput({
        ...row,
        data: { ...row.data, customerId },
      })

      const selectedCrew = form.crewId
        ? crews.find((crew) => crew.id === form.crewId)
        : undefined
      const snapshots = resolveCrewSnapshotsForAssignment(selectedCrew)

      const payload = buildWorkOrderCreatePayload({
        form,
        existingTasks: workingTasks,
        customerId,
        crewId: snapshots.crewId,
        crewName: snapshots.crew,
        supervisor: resolveSupervisorFromCrew(selectedCrew) || snapshots.supervisor,
        checklist: taskDefaultChecklist,
      })

      const createdTask = await addTask(payload)
      workingTasks = [...workingTasks, createdTask]
      imported += 1

      if (row.status === "warning") {
        importedWithWarnings += 1
        reportRows.push(
          buildReportRow(
            row,
            "Importada con advertencias",
            row.issues.map((issue) => issue.message).join(" · "),
            "Revisar datos operativos luego de la importación"
          )
        )
      } else {
        reportRows.push(buildReportRow(row, "Importada", "", ""))
      }
    } catch (error) {
      failed += 1
      reportRows.push(
        buildReportRow(
          row,
          "Error",
          error instanceof Error ? error.message : "Error inesperado",
          "Corrija la fila e intente nuevamente"
        )
      )
    }
  }

  return {
    analyzed: rows.length,
    imported,
    importedWithWarnings,
    excluded,
    failed,
    reportRows,
  }
}
