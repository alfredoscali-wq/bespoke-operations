import { normalizeComparisonKey } from "@/lib/customers/normalization"
import { normalizeImportFieldValues } from "@/lib/customers/customer-import/normalize"
import type {
  CustomerImportRowData,
  ImportIssue,
} from "@/lib/customers/customer-import/types"
import type { Customer } from "@/lib/types/customers"

export type BatchDuplicateState = {
  externalCodes: Map<string, number>
  namePhoneKeys: Map<string, number>
  namesWithoutPhone: Map<string, number>
}

export function createBatchDuplicateState(): BatchDuplicateState {
  return {
    externalCodes: new Map(),
    namePhoneKeys: new Map(),
    namesWithoutPhone: new Map(),
  }
}

function buildNamePhoneKey(name: string, phone: string): string | null {
  const normalizedName = normalizeComparisonKey(name)
  const trimmedPhone = phone.trim()

  if (!normalizedName || !trimmedPhone) {
    return null
  }

  return `${normalizedName}::${trimmedPhone}`
}

export function findCustomerByExternalCode(
  customers: Customer[],
  code: string
): Customer | undefined {
  const normalizedCode = normalizeComparisonKey(code)
  if (!normalizedCode) return undefined

  return customers.find(
    (customer) =>
      customer.externalCustomerCode &&
      normalizeComparisonKey(customer.externalCustomerCode) === normalizedCode
  )
}

export function findCustomerByNameAndPhone(
  customers: Customer[],
  name: string,
  phone: string
): Customer | undefined {
  const key = buildNamePhoneKey(name, phone)
  if (!key) return undefined

  return customers.find((customer) => {
    const customerKey = buildNamePhoneKey(customer.name, customer.phone ?? "")
    return customerKey === key
  })
}

export function findCustomerByExactName(
  customers: Customer[],
  name: string
): Customer | undefined {
  const normalizedName = normalizeComparisonKey(name)
  if (!normalizedName) return undefined

  return customers.find(
    (customer) => normalizeComparisonKey(customer.name) === normalizedName
  )
}

export function checkBatchDuplicates(
  rowNumber: number,
  data: CustomerImportRowData,
  state: BatchDuplicateState
): ImportIssue[] {
  const issues: ImportIssue[] = []
  const externalCode = data.externalCustomerCode.trim()

  if (externalCode) {
    const key = normalizeComparisonKey(externalCode)
    const firstRow = state.externalCodes.get(key)

    if (firstRow !== undefined && firstRow !== rowNumber) {
      issues.push({
        level: "error",
        field: "externalCustomerCode",
        message: `codigo_externo duplicado en el archivo (fila ${firstRow})`,
        suggestion: "Use un código externo único por fila",
      })
    }
  }

  const namePhoneKey = buildNamePhoneKey(data.name, data.phone)
  if (namePhoneKey) {
    const firstRow = state.namePhoneKeys.get(namePhoneKey)

    if (firstRow !== undefined && firstRow !== rowNumber) {
      issues.push({
        level: "error",
        field: "name",
        message: `nombre y teléfono duplicados en el archivo (fila ${firstRow})`,
        suggestion: "Elimine la fila duplicada o corrija los datos",
      })
    }
  }

  return issues
}

export function checkNameWithoutPhoneDuplicate(
  rowNumber: number,
  data: CustomerImportRowData,
  state: BatchDuplicateState
): ImportIssue[] {
  if (data.phone.trim()) {
    return []
  }

  const normalizedName = normalizeComparisonKey(data.name)
  if (!normalizedName) {
    return []
  }

  const firstRow = state.namesWithoutPhone.get(normalizedName)
  if (firstRow !== undefined && firstRow !== rowNumber) {
    return [
      {
        level: "warning",
        field: "name",
        message: `Nombre repetido sin teléfono (fila ${firstRow})`,
        suggestion: "Verifique si se trata del mismo cliente o de un homónimo",
      },
    ]
  }

  return []
}

export function registerBatchRow(
  rowNumber: number,
  data: CustomerImportRowData,
  state: BatchDuplicateState
): void {
  const externalCode = data.externalCustomerCode.trim()
  if (externalCode) {
    const key = normalizeComparisonKey(externalCode)
    if (!state.externalCodes.has(key)) {
      state.externalCodes.set(key, rowNumber)
    }
  }

  const namePhoneKey = buildNamePhoneKey(data.name, data.phone)
  if (namePhoneKey && !state.namePhoneKeys.has(namePhoneKey)) {
    state.namePhoneKeys.set(namePhoneKey, rowNumber)
  }

  if (!data.phone.trim()) {
    const normalizedName = normalizeComparisonKey(data.name)
    if (normalizedName && !state.namesWithoutPhone.has(normalizedName)) {
      state.namesWithoutPhone.set(normalizedName, rowNumber)
    }
  }
}

export function normalizeImportRowData(
  data: CustomerImportRowData
): CustomerImportRowData {
  const normalized = normalizeImportFieldValues({
    externalCustomerCode: data.externalCustomerCode,
    name: data.name,
    phone: data.phone,
    email: data.email,
    address: data.address,
    locality: data.locality,
    technology: data.technology,
    status: data.status,
  })

  return {
    ...data,
    ...normalized,
    technology: normalized.technology || data.technology,
  }
}
