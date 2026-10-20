import { foldAbnetHeader } from "@/lib/isp/abnet-connection-registry"
import {
  abnetNumberFromExternalCode,
  documentDigits,
  isReliableIdentityDocument,
  normalizeCustomerName,
  packAbnetLocality,
} from "@/lib/isp/abnet-master-universe"

export const ABNET_CUSTOMER_IMPORT_MAX_ROWS = 20_000

export type AbnetCustomerParseIssue = {
  rowNumber: number
  reason: string
}

export type AbnetCustomerRecord = {
  customerNumber: string
  name: string
  document: string | null
  documentType: string
  documentReview: boolean
  email: string
  phone: string
  address: string
  city: string
  province: string
  commercialStatus: string
  personType: string
  taxCondition: string
  abnetClientId: string
  sourceBalance: string
  notes: string
  reviewRequired: boolean
  reviewReason: string | null
}

export type AbnetCustomerParseResult = {
  records: AbnetCustomerRecord[]
  issues: AbnetCustomerParseIssue[]
  headerRowNumber: number
}

type CustomerDraft = {
  rowNumber: number
  customerNumber: string
  name: string
  document: string | null
  documentType: string
  documentReview: boolean
  email: string
  phone: string
  address: string
  city: string
  province: string
  commercialStatus: string
  personType: string
  taxCondition: string
  abnetClientId: string
  sourceBalance: string
  notes: string
}

function cellText(value: unknown): string {
  if (value == null) return ""
  return String(value).trim()
}

function headerIndex(header: readonly unknown[], names: readonly string[]): number {
  const folded = header.map((cell) => foldAbnetHeader(cell))
  return folded.findIndex((cell) => names.includes(cell))
}

function sameIdentity(left: CustomerDraft, right: CustomerDraft): boolean {
  const fields: (keyof CustomerDraft)[] = [
    "name",
    "document",
    "documentType",
    "documentReview",
    "email",
    "phone",
    "address",
    "city",
    "province",
    "commercialStatus",
    "personType",
    "taxCondition",
    "abnetClientId",
  ]
  return fields.every((field) => String(left[field] ?? "") === String(right[field] ?? ""))
}

function blankRecord(number: string, reviewReason: string): AbnetCustomerRecord {
  return {
    customerNumber: number,
    name: "",
    document: null,
    documentType: "",
    documentReview: true,
    email: "",
    phone: "",
    address: "",
    city: "",
    province: "",
    commercialStatus: "",
    personType: "",
    taxCondition: "",
    abnetClientId: "",
    sourceBalance: "",
    notes: "",
    reviewRequired: true,
    reviewReason,
  }
}

function recordFromDraft(draft: CustomerDraft): AbnetCustomerRecord {
  return {
    customerNumber: draft.customerNumber,
    name: draft.name,
    document: draft.documentReview ? null : draft.document,
    documentType: draft.documentType,
    documentReview: draft.documentReview,
    email: draft.email,
    phone: draft.phone,
    address: draft.address,
    city: draft.city,
    province: draft.province,
    commercialStatus: draft.commercialStatus,
    personType: draft.personType,
    taxCondition: draft.taxCondition,
    abnetClientId: draft.abnetClientId,
    sourceBalance: draft.sourceBalance,
    notes: draft.notes,
    reviewRequired: false,
    reviewReason: draft.documentReview
      ? "El archivo marca el documento para revisión."
      : null,
  }
}

export function parseAbnetCustomerSheet(matrix: readonly (readonly unknown[])[]): AbnetCustomerParseResult {
  const headerRowNumber = matrix.findIndex(
    (row) => row.some((cell) => cellText(cell) !== "")
  )
  if (headerRowNumber < 0) {
    return { records: [], issues: [{ rowNumber: 0, reason: "El archivo no tiene encabezados." }], headerRowNumber: 0 }
  }
  const header = matrix[headerRowNumber] ?? []
  const numberIndex = headerIndex(header, ["ncliente", "numerocliente", "nrocliente"])
  if (numberIndex < 0) {
    return {
      records: [],
      issues: [{ rowNumber: headerRowNumber + 1, reason: "Falta la columna N° Cliente." }],
      headerRowNumber: headerRowNumber + 1,
    }
  }
  const nameIndex = headerIndex(header, ["nombre"])
  const reviewIndex = headerIndex(header, ["revisardoc"])
  const documentIndex = headerIndex(header, ["dnicuit", "documento"])
  const documentTypeIndex = headerIndex(header, ["tipodoc"])
  const emailIndex = headerIndex(header, ["email", "mail"])
  const phoneIndex = headerIndex(header, ["telefono"])
  const addressIndex = headerIndex(header, ["domicilio"])
  const provinceIndex = headerIndex(header, ["provincia"])
  const cityIndex = headerIndex(header, ["ciudad", "localidad"])
  const statusIndex = headerIndex(header, ["estado"])
  const personIndex = headerIndex(header, ["tipopersona"])
  const taxIndex = headerIndex(header, ["condiva", "condicioniva"])
  const clientIndex = headerIndex(header, ["idclientes"])
  const balanceIndex = headerIndex(header, ["saldo"])
  const notesIndex = headerIndex(header, ["observ", "observacion", "observaciones"])

  const drafts: CustomerDraft[] = []
  const issues: AbnetCustomerParseIssue[] = []
  let dataRows = 0
  for (let index = headerRowNumber + 1; index < matrix.length; index += 1) {
    const line = matrix[index] ?? []
    if (line.every((cell) => cellText(cell) === "")) continue
    dataRows += 1
    if (dataRows > ABNET_CUSTOMER_IMPORT_MAX_ROWS) {
      issues.push({ rowNumber: index + 1, reason: `El archivo supera ${ABNET_CUSTOMER_IMPORT_MAX_ROWS} filas.` })
      break
    }
    const rawNumber = cellText(line[numberIndex])
    const customerNumber = abnetNumberFromExternalCode(rawNumber)
    if (!rawNumber || !customerNumber || customerNumber === "99999999") {
      issues.push({
        rowNumber: index + 1,
        reason: "N° Cliente ausente o no utilizable. No se usó el DNI ni el Id.",
      })
      continue
    }
    const rawDocument = documentIndex >= 0 ? cellText(line[documentIndex]) : ""
    const documentReview = reviewIndex >= 0 && foldAbnetHeader(line[reviewIndex]) === "si"
    const reliable = !documentReview && isReliableIdentityDocument(rawDocument)
    drafts.push({
      rowNumber: index + 1,
      customerNumber,
      name: nameIndex >= 0 ? cellText(line[nameIndex]) : "",
      document: reliable ? documentDigits(rawDocument) : null,
      documentType: documentTypeIndex >= 0 ? cellText(line[documentTypeIndex]) : "",
      documentReview,
      email: emailIndex >= 0 ? cellText(line[emailIndex]) : "",
      phone: phoneIndex >= 0 ? cellText(line[phoneIndex]) : "",
      address: addressIndex >= 0 ? cellText(line[addressIndex]) : "",
      city: cityIndex >= 0 ? cellText(line[cityIndex]) : "",
      province: provinceIndex >= 0 ? cellText(line[provinceIndex]) : "",
      commercialStatus: statusIndex >= 0 ? cellText(line[statusIndex]) : "",
      personType: personIndex >= 0 ? cellText(line[personIndex]) : "",
      taxCondition: taxIndex >= 0 ? cellText(line[taxIndex]) : "",
      abnetClientId: clientIndex >= 0 ? cellText(line[clientIndex]) : "",
      sourceBalance: balanceIndex >= 0 ? cellText(line[balanceIndex]) : "",
      notes: notesIndex >= 0 ? cellText(line[notesIndex]) : "",
    })
  }

  const grouped = new Map<string, CustomerDraft[]>()
  for (const draft of drafts) {
    const group = grouped.get(draft.customerNumber) ?? []
    group.push(draft)
    grouped.set(draft.customerNumber, group)
  }
  const records: AbnetCustomerRecord[] = []
  for (const [number, group] of grouped) {
    if (group.length > 1) {
      const contradictory = group.some((row) => !sameIdentity(row, group[0]))
      records.push(
        blankRecord(
          number,
          contradictory
            ? "Los datos personales del número de cliente se contradicen."
            : "El número de cliente está repetido en clientes.xlsx."
        )
      )
      continue
    }
    records.push(recordFromDraft(group[0]))
  }
  records.sort((left, right) =>
    left.customerNumber.localeCompare(right.customerNumber, "es", { numeric: true })
  )
  return { records, issues, headerRowNumber: headerRowNumber + 1 }
}

export function planAbnetCustomerImport(
  existing: readonly Pick<AbnetCustomerRecord, "customerNumber" | "name" | "document" | "reviewRequired">[],
  parsed: AbnetCustomerParseResult
) {
  const previous = new Set(existing.map((row) => row.customerNumber))
  let created = 0
  let updated = 0
  for (const record of parsed.records) {
    if (previous.has(record.customerNumber)) updated += 1
    else created += 1
  }
  return {
    valid: parsed.records.length,
    invalid: parsed.issues.length,
    created,
    updated,
    unchanged: 0,
    review: parsed.records.filter((row) => row.reviewRequired || row.documentReview).length,
    issues: parsed.issues,
    records: parsed.records,
  }
}

export type AbnetPersonalTarget = {
  name: string
  externalCode: string | null
  dni: string | null
  phone: string | null
  email: string | null
  address: string | null
  locality: string | null
  note: string
}

function filled(value: string | null | undefined): string | null {
  const text = value?.trim() ?? ""
  return text ? text : null
}

function appendNote(note: string, extra: string): string {
  if (!extra || note.includes(extra)) return note
  return note ? `${note} ${extra}` : extra
}

export function completeAbnetPersonalProfile<T extends AbnetPersonalTarget>(
  target: T,
  record: AbnetCustomerRecord | null
): T {
  if (!record) return target
  if (record.reviewRequired) {
    return {
      ...target,
      note: appendNote(
        target.note,
        record.reviewReason ?? "Los datos personales requieren revisión manual."
      ),
    }
  }
  const number = abnetNumberFromExternalCode(target.externalCode)
  let name = target.name
  let note = target.note
  const personalName = filled(record.name)
  const fallback = number ? `abonado ${number}` : ""
  if (personalName && normalizeCustomerName(target.name) === fallback) {
    name = personalName
  } else if (
    personalName &&
    filled(target.name) &&
    normalizeCustomerName(target.name) !== normalizeCustomerName(personalName)
  ) {
    note = appendNote(note, "El nombre informado no coincide con el padrón. Se conserva el nombre ya mostrado.")
  }
  const dni = mergeField(target.dni, record.documentReview ? null : record.document, "DNI/CUIT", (current, incoming) => {
    note = appendNote(note, current)
    return incoming
  })
  const phone = mergeField(target.phone, record.phone, "teléfono", (current) => {
    note = appendNote(note, current)
  })
  const email = mergeField(target.email, record.email, "email", (current) => {
    note = appendNote(note, current)
  })
  const address = mergeField(target.address, record.address, "domicilio", (current) => {
    note = appendNote(note, current)
  })
  const locality = mergeField(
    target.locality,
    packAbnetLocality(record.city, record.province),
    "localidad",
    (current) => {
      note = appendNote(note, current)
    }
  )
  if (record.documentReview) {
    note = appendNote(note, "El DNI/CUIT está marcado para revisión y no se completa.")
  }
  return {
    ...target,
    name,
    dni: dni.value,
    phone: phone.value,
    email: email.value,
    address: address.value,
    locality: locality.value,
    note,
  }
}

function mergeField(
  current: string | null,
  incoming: string | null,
  label: string,
  onConflict: (note: string, kept: string | null) => void
): { value: string | null } {
  const present = filled(current)
  const next = filled(incoming)
  if (!next) return { value: present }
  if (!present) return { value: next }
  if (normalizeCustomerName(present) === normalizeCustomerName(next)) return { value: present }
  if (label === "DNI/CUIT" && documentDigits(present) === documentDigits(next)) return { value: present }
  onConflict(
    `El ${label} de Bespoke se conserva porque no coincide con clientes.xlsx.`,
    present
  )
  return { value: present }
}
