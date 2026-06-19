import type { WorkOrderImportRowData } from "@/lib/tasks/work-order-import/types"

export type WorkOrderImportField = keyof WorkOrderImportRowData

const COLUMN_ALIASES: Record<WorkOrderImportField, string[]> = {
  serviceType: [
    "tipo_orden",
    "tipo de orden",
    "tipo orden",
    "tipo",
    "service_type",
    "servicio",
  ],
  customerName: [
    "cliente",
    "nombre",
    "nombre_cliente",
    "customer_name",
    "nombre cliente",
  ],
  customerPhone: ["telefono", "teléfono", "phone", "customer_phone"],
  customerEmail: ["email", "correo", "mail", "customer_email"],
  customerId: ["customer_id", "id_cliente"],
  scheduledDate: [
    "fecha",
    "fecha_programada",
    "fecha programada",
    "scheduled_date",
    "due_date",
  ],
  crewName: ["cuadrilla", "crew", "equipo"],
  crewId: ["crew_id", "id_cuadrilla"],
  observations: ["observaciones", "notas", "comentarios", "description"],
  address: ["direccion", "dirección", "domicilio", "service_address"],
  locality: ["localidad", "ciudad", "municipio"],
  technology: ["tecnologia", "tecnología", "technology", "tech"],
  currentAddress: [
    "direccion_actual",
    "dirección actual",
    "domicilio actual",
    "current_address",
  ],
  newAddress: [
    "nueva_direccion",
    "nueva dirección",
    "domicilio nuevo",
    "new_address",
  ],
  currentLocality: ["localidad_actual", "localidad actual", "current_locality"],
  newLocality: ["nueva_localidad", "localidad nueva", "new_locality"],
  currentTechnology: [
    "tecnologia_actual",
    "tecnología actual",
    "current_technology",
  ],
  newTechnology: ["nueva_tecnologia", "nueva tecnología", "new_technology"],
  serviceReason: ["motivo", "motivo_service", "reason"],
  serviceDetail: ["detalle", "detalle_service", "detail"],
  cancellationReason: ["motivo_baja", "motivo de baja", "cancellation_reason"],
  equipmentToRemove: ["equipo_retirar", "equipo a retirar", "equipment"],
  surveyReason: ["motivo_relevamiento", "motivo relevamiento", "survey_reason"],
  postventaDetail: ["detalle_postventa", "detalle postventa", "postventa"],
  customerCompany: [
    "empresa_cliente",
    "empresa cliente",
    "customer_company",
    "cliente_operativo",
  ],
  externalReference: [
    "referencia_externa",
    "referencia externa",
    "external_reference",
  ],
  clientOrderNumber: [
    "numero_orden_cliente",
    "número orden cliente",
    "numero orden cliente",
    "work_order_number",
    "orden_cliente",
  ],
  province: ["provincia", "province", "state"],
  postalCode: ["codigo_postal", "código postal", "codigo postal", "postal_code", "cp"],
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

const HEADER_TO_FIELD = new Map<string, WorkOrderImportField>()

for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [
  WorkOrderImportField,
  string[],
][]) {
  for (const alias of aliases) {
    HEADER_TO_FIELD.set(normalizeImportHeader(alias), field)
  }
}

export function mapImportHeaders(
  headers: string[]
): Partial<Record<number, WorkOrderImportField>> {
  const mapping: Partial<Record<number, WorkOrderImportField>> = {}

  headers.forEach((header, index) => {
    const field = HEADER_TO_FIELD.get(normalizeImportHeader(header))
    if (field) {
      mapping[index] = field
    }
  })

  return mapping
}

export function getEmptyImportRowData(): WorkOrderImportRowData {
  return {
    serviceType: "",
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    customerId: "",
    scheduledDate: "",
    crewName: "",
    crewId: "",
    observations: "",
    address: "",
    locality: "",
    technology: "",
    currentAddress: "",
    newAddress: "",
    currentLocality: "",
    newLocality: "",
    currentTechnology: "",
    newTechnology: "",
    serviceReason: "",
    serviceDetail: "",
    cancellationReason: "",
    equipmentToRemove: "",
    surveyReason: "",
    postventaDetail: "",
    customerCompany: "",
    externalReference: "",
    clientOrderNumber: "",
    province: "",
    postalCode: "",
  }
}
