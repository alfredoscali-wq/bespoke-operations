import type { CustomerImportRowData } from "@/lib/customers/customer-import/types"

export type CustomerImportField = keyof CustomerImportRowData

const COLUMN_ALIASES: Record<CustomerImportField, string[]> = {
  externalCustomerCode: [
    "codigo_externo",
    "código externo",
    "codigo externo",
    "external_customer_code",
    "external_code",
    "codigo_cliente",
  ],
  name: ["nombre", "cliente", "nombre_cliente", "customer_name", "name"],
  phone: ["telefono", "teléfono", "phone", "customer_phone"],
  email: ["email", "correo", "mail", "customer_email"],
  address: ["direccion", "dirección", "domicilio", "address"],
  locality: ["localidad", "ciudad", "municipio", "locality"],
  technology: ["tecnologia", "tecnología", "technology", "tech"],
  status: ["estado", "status", "customer_status"],
}

export function normalizeImportHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

const HEADER_TO_FIELD = new Map<string, CustomerImportField>()

for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [
  CustomerImportField,
  string[],
][]) {
  for (const alias of aliases) {
    HEADER_TO_FIELD.set(normalizeImportHeader(alias), field)
  }
}

export function mapImportHeaders(
  headers: string[]
): Partial<Record<number, CustomerImportField>> {
  const mapping: Partial<Record<number, CustomerImportField>> = {}

  headers.forEach((header, index) => {
    const field = HEADER_TO_FIELD.get(normalizeImportHeader(header))
    if (field) {
      mapping[index] = field
    }
  })

  return mapping
}

export function getEmptyImportRowData(): CustomerImportRowData {
  return {
    externalCustomerCode: "",
    name: "",
    phone: "",
    email: "",
    address: "",
    locality: "",
    technology: "",
    status: "",
  }
}
