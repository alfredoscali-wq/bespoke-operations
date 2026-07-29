import type {
  CommercialOpportunityInsert,
  CommercialOpportunityRow,
  CommercialOpportunityUpdate,
  CommercialPersonInsert,
  CommercialPersonRow,
  CommercialPersonUpdate,
} from "@/lib/supabase/database.aliases"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import type {
  CommercialOpportunity,
  CommercialPerson,
} from "@/lib/types/commercial"
import type {
  CreateCommercialOpportunityPayload,
  CreateCommercialPersonPayload,
  UpdateCommercialOpportunityPayload,
  UpdateCommercialPersonPayload,
} from "@/lib/types/supabase/commercial"
import type {
  CommercialLocationSource,
  CommercialPriorityCode,
  CommercialSourceCode,
  CommercialStatusCode,
} from "@/lib/commercial/catalogs"
import { roundCoordinate } from "@/lib/gps"

export function mapCommercialPersonRowToPerson(
  row: CommercialPersonRow
): CommercialPerson {
  return {
    id: row.id,
    companyId: row.company_id,
    personType: row.person_type,
    firstName: row.first_name,
    lastName: row.last_name,
    companyName: row.company_name,
    documentNumber: row.document_number,
    taxId: row.tax_id,
    phone: row.phone,
    mobile: row.mobile,
    email: row.email,
    street: row.street ?? "",
    streetNumber: row.street_number ?? "",
    floor: row.floor ?? "",
    apartment: row.apartment ?? "",
    neighborhood: row.neighborhood ?? "",
    address: row.address,
    city: row.city,
    province: row.province,
    postalCode: row.postal_code,
    latitude:
      row.latitude === null || row.latitude === undefined
        ? null
        : Number(row.latitude),
    longitude:
      row.longitude === null || row.longitude === undefined
        ? null
        : Number(row.longitude),
    locationSource: (row.location_source ??
      null) as CommercialLocationSource | null,
    notes: row.notes,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    deletedBy: row.deleted_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

export function mapCreateCommercialPersonPayloadToInsert(
  payload: CreateCommercialPersonPayload
): CommercialPersonInsert {
  return {
    company_id: payload.companyId ?? BESPOKE_PRODUCTION_COMPANY_ID,
    person_type: payload.personType ?? "individual",
    first_name: payload.firstName?.trim() ?? "",
    last_name: payload.lastName?.trim() ?? "",
    company_name: payload.companyName?.trim() ?? "",
    document_number: payload.documentNumber?.trim() ?? "",
    tax_id: payload.taxId?.trim() ?? "",
    phone: payload.phone?.trim() ?? "",
    mobile: payload.mobile?.trim() ?? "",
    email: payload.email?.trim() ?? "",
    street: payload.street?.trim() ?? "",
    street_number: payload.streetNumber?.trim() ?? "",
    floor: payload.floor?.trim() ?? "",
    apartment: payload.apartment?.trim() ?? "",
    neighborhood: payload.neighborhood?.trim() ?? "",
    address: payload.address?.trim() ?? "",
    city: payload.city?.trim() ?? "",
    province: payload.province?.trim() ?? "",
    postal_code: payload.postalCode?.trim() ?? "",
    latitude:
      payload.latitude == null ? null : roundCoordinate(payload.latitude),
    longitude:
      payload.longitude == null ? null : roundCoordinate(payload.longitude),
    location_source: payload.locationSource ?? null,
    notes: payload.notes?.trim() ?? "",
    created_by: payload.createdBy ?? null,
  }
}

export function mapUpdateCommercialPersonPayloadToUpdate(
  payload: UpdateCommercialPersonPayload
): CommercialPersonUpdate {
  const update: CommercialPersonUpdate = {}

  if (payload.personType !== undefined) update.person_type = payload.personType
  if (payload.firstName !== undefined) update.first_name = payload.firstName.trim()
  if (payload.lastName !== undefined) update.last_name = payload.lastName.trim()
  if (payload.companyName !== undefined) {
    update.company_name = payload.companyName.trim()
  }
  if (payload.documentNumber !== undefined) {
    update.document_number = payload.documentNumber.trim()
  }
  if (payload.taxId !== undefined) update.tax_id = payload.taxId.trim()
  if (payload.phone !== undefined) update.phone = payload.phone.trim()
  if (payload.mobile !== undefined) update.mobile = payload.mobile.trim()
  if (payload.email !== undefined) update.email = payload.email.trim()
  if (payload.street !== undefined) update.street = payload.street.trim()
  if (payload.streetNumber !== undefined) {
    update.street_number = payload.streetNumber.trim()
  }
  if (payload.floor !== undefined) update.floor = payload.floor.trim()
  if (payload.apartment !== undefined) update.apartment = payload.apartment.trim()
  if (payload.neighborhood !== undefined) {
    update.neighborhood = payload.neighborhood.trim()
  }
  if (payload.address !== undefined) update.address = payload.address.trim()
  if (payload.city !== undefined) update.city = payload.city.trim()
  if (payload.province !== undefined) update.province = payload.province.trim()
  if (payload.postalCode !== undefined) {
    update.postal_code = payload.postalCode.trim()
  }
  if (payload.latitude !== undefined) {
    update.latitude =
      payload.latitude == null ? null : roundCoordinate(payload.latitude)
  }
  if (payload.longitude !== undefined) {
    update.longitude =
      payload.longitude == null ? null : roundCoordinate(payload.longitude)
  }
  if (payload.locationSource !== undefined) {
    update.location_source = payload.locationSource
  }
  if (payload.notes !== undefined) update.notes = payload.notes.trim()
  if (payload.updatedBy !== undefined) update.updated_by = payload.updatedBy

  return update
}

export function mapCommercialOpportunityRowToOpportunity(
  row: CommercialOpportunityRow | Record<string, unknown>
): CommercialOpportunity {
  const data = row as CommercialOpportunityRow & {
    etiqueta_id?: string | null
  }

  return {
    id: data.id,
    companyId: data.company_id,
    personId: data.person_id,
    code: data.code,
    title: data.title,
    status: data.status as CommercialStatusCode,
    priority: data.priority as CommercialPriorityCode,
    source: data.source as CommercialSourceCode,
    assignedEmployeeId: data.assigned_employee_id,
    estimatedAmount:
      data.estimated_amount === null || data.estimated_amount === undefined
        ? null
        : Number(data.estimated_amount),
    probability: data.probability,
    expectedCloseDate: data.expected_close_date,
    description: data.description,
    lostReason: data.lost_reason,
    latitude:
      data.latitude === null || data.latitude === undefined
        ? null
        : Number(data.latitude),
    longitude:
      data.longitude === null || data.longitude === undefined
        ? null
        : Number(data.longitude),
    locationSource: (data.location_source ??
      null) as CommercialLocationSource | null,
    etiquetaId: data.etiqueta_id ?? null,
    etiquetaName: null,
    etiquetaColor: null,
    sellerOpenedAt: data.seller_opened_at ?? null,
    sourceAtencionId: data.source_atencion_id ?? null,
    sourceCustomerId: data.source_customer_id ?? null,
    createdBy: data.created_by,
    updatedBy: data.updated_by,
    deletedBy: data.deleted_by,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    deletedAt: data.deleted_at,
  }
}

export function mapCreateCommercialOpportunityPayloadToInsert(
  payload: CreateCommercialOpportunityPayload
): CommercialOpportunityInsert & { etiqueta_id?: string | null } {
  const insert: CommercialOpportunityInsert & { etiqueta_id?: string | null } = {
    company_id: payload.companyId ?? BESPOKE_PRODUCTION_COMPANY_ID,
    person_id: payload.personId,
    title: payload.title.trim(),
    status: payload.status ?? "nueva",
    priority: payload.priority ?? "media",
    source: payload.source ?? "otro",
    assigned_employee_id: payload.assignedEmployeeId ?? null,
    estimated_amount: payload.estimatedAmount ?? null,
    probability: payload.probability ?? null,
    expected_close_date: payload.expectedCloseDate ?? null,
    description: payload.description?.trim() ?? "",
    lost_reason: payload.lostReason?.trim() ?? "",
    latitude:
      payload.latitude == null ? null : roundCoordinate(payload.latitude),
    longitude:
      payload.longitude == null ? null : roundCoordinate(payload.longitude),
    location_source: payload.locationSource ?? null,
    seller_opened_at: payload.sellerOpenedAt ?? null,
    source_atencion_id: payload.sourceAtencionId ?? null,
    source_customer_id: payload.sourceCustomerId ?? null,
    created_by: payload.createdBy ?? null,
  }

  const code = payload.code?.trim()
  if (code) {
    insert.code = code
  }

  if (payload.etiquetaId !== undefined) {
    insert.etiqueta_id = payload.etiquetaId
  }

  return insert
}

export function mapUpdateCommercialOpportunityPayloadToUpdate(
  payload: UpdateCommercialOpportunityPayload
): CommercialOpportunityUpdate & { etiqueta_id?: string | null } {
  const update: CommercialOpportunityUpdate & { etiqueta_id?: string | null } =
    {}

  if (payload.personId !== undefined) update.person_id = payload.personId
  if (payload.title !== undefined) update.title = payload.title.trim()
  if (payload.status !== undefined) update.status = payload.status
  if (payload.priority !== undefined) update.priority = payload.priority
  if (payload.source !== undefined) update.source = payload.source
  if (payload.assignedEmployeeId !== undefined) {
    update.assigned_employee_id = payload.assignedEmployeeId
  }
  if (payload.estimatedAmount !== undefined) {
    update.estimated_amount = payload.estimatedAmount
  }
  if (payload.probability !== undefined) update.probability = payload.probability
  if (payload.expectedCloseDate !== undefined) {
    update.expected_close_date = payload.expectedCloseDate
  }
  if (payload.description !== undefined) {
    update.description = payload.description.trim()
  }
  if (payload.lostReason !== undefined) {
    update.lost_reason = payload.lostReason.trim()
  }
  if (payload.latitude !== undefined) {
    update.latitude =
      payload.latitude == null ? null : roundCoordinate(payload.latitude)
  }
  if (payload.longitude !== undefined) {
    update.longitude =
      payload.longitude == null ? null : roundCoordinate(payload.longitude)
  }
  if (payload.locationSource !== undefined) {
    update.location_source = payload.locationSource
  }
  if (payload.etiquetaId !== undefined) {
    update.etiqueta_id = payload.etiquetaId
  }
  if (payload.sellerOpenedAt !== undefined) {
    update.seller_opened_at = payload.sellerOpenedAt
  }
  if (payload.sourceAtencionId !== undefined) {
    update.source_atencion_id = payload.sourceAtencionId
  }
  if (payload.sourceCustomerId !== undefined) {
    update.source_customer_id = payload.sourceCustomerId
  }
  if (payload.updatedBy !== undefined) update.updated_by = payload.updatedBy

  return update
}

export function resolveCommercialPersonDisplayName(
  person: Pick<
    CommercialPerson,
    "personType" | "firstName" | "lastName" | "companyName"
  >
): string {
  if (person.personType === "company") {
    const company = person.companyName.trim()
    if (company) return company
  }

  const fullName = `${person.firstName} ${person.lastName}`.trim()
  if (fullName) return fullName

  return person.companyName.trim() || "Persona sin nombre"
}
