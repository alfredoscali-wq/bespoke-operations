import type {
  CommercialOpportunityInsert,
  CommercialOpportunityRow,
  CommercialOpportunityUpdate,
  CommercialPersonInsert,
  CommercialPersonRow,
  CommercialPersonUpdate,
} from "@/lib/supabase/database.types"
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
  CommercialPriorityCode,
  CommercialSourceCode,
  CommercialStatusCode,
} from "@/lib/commercial/catalogs"

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
    address: row.address,
    city: row.city,
    province: row.province,
    postalCode: row.postal_code,
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
    address: payload.address?.trim() ?? "",
    city: payload.city?.trim() ?? "",
    province: payload.province?.trim() ?? "",
    postal_code: payload.postalCode?.trim() ?? "",
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
  if (payload.address !== undefined) update.address = payload.address.trim()
  if (payload.city !== undefined) update.city = payload.city.trim()
  if (payload.province !== undefined) update.province = payload.province.trim()
  if (payload.postalCode !== undefined) {
    update.postal_code = payload.postalCode.trim()
  }
  if (payload.notes !== undefined) update.notes = payload.notes.trim()
  if (payload.updatedBy !== undefined) update.updated_by = payload.updatedBy

  return update
}

export function mapCommercialOpportunityRowToOpportunity(
  row: CommercialOpportunityRow
): CommercialOpportunity {
  return {
    id: row.id,
    companyId: row.company_id,
    personId: row.person_id,
    code: row.code,
    title: row.title,
    status: row.status as CommercialStatusCode,
    priority: row.priority as CommercialPriorityCode,
    source: row.source as CommercialSourceCode,
    assignedEmployeeId: row.assigned_employee_id,
    estimatedAmount:
      row.estimated_amount === null || row.estimated_amount === undefined
        ? null
        : Number(row.estimated_amount),
    probability: row.probability,
    expectedCloseDate: row.expected_close_date,
    description: row.description,
    lostReason: row.lost_reason,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    deletedBy: row.deleted_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }
}

export function mapCreateCommercialOpportunityPayloadToInsert(
  payload: CreateCommercialOpportunityPayload
): CommercialOpportunityInsert {
  const insert: CommercialOpportunityInsert = {
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
    created_by: payload.createdBy ?? null,
  }

  const code = payload.code?.trim()
  if (code) {
    insert.code = code
  }

  return insert
}

export function mapUpdateCommercialOpportunityPayloadToUpdate(
  payload: UpdateCommercialOpportunityPayload
): CommercialOpportunityUpdate {
  const update: CommercialOpportunityUpdate = {}

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

  return person.companyName.trim() || "Prospecto sin nombre"
}
