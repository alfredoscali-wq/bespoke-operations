import type {
  ContractorInsert,
  ContractorRow,
  ContractorUpdate,
} from "@/lib/supabase/database.types"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import type { Contractor } from "@/lib/types/contractors"
import type {
  CreateContractorPayload,
  UpdateContractorPayload,
} from "@/lib/types/supabase/contractors"

export function mapContractorRowToContractor(row: ContractorRow): Contractor {
  return {
    id: row.id,
    companyId: row.company_id,
    legalName: row.legal_name,
    tradeName: row.trade_name,
    taxId: row.tax_id,
    responsibleName: row.responsible_name,
    phone: row.phone,
    email: row.email,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapCreateContractorPayloadToInsert(
  payload: CreateContractorPayload
): ContractorInsert {
  return {
    company_id: payload.companyId ?? BESPOKE_PRODUCTION_COMPANY_ID,
    legal_name: payload.legalName.trim(),
    trade_name: payload.tradeName?.trim() ?? "",
    tax_id: payload.taxId.trim(),
    responsible_name: payload.responsibleName?.trim() ?? "",
    phone: payload.phone?.trim() ?? "",
    email: payload.email?.trim() ?? "",
    status: payload.status ?? "activo",
    notes: payload.notes?.trim() ?? "",
  }
}

export function mapUpdateContractorPayloadToUpdate(
  payload: UpdateContractorPayload
): ContractorUpdate {
  const update: ContractorUpdate = {}

  if (payload.legalName !== undefined) {
    update.legal_name = payload.legalName.trim()
  }
  if (payload.tradeName !== undefined) {
    update.trade_name = payload.tradeName.trim()
  }
  if (payload.taxId !== undefined) {
    update.tax_id = payload.taxId.trim()
  }
  if (payload.responsibleName !== undefined) {
    update.responsible_name = payload.responsibleName.trim()
  }
  if (payload.phone !== undefined) {
    update.phone = payload.phone.trim()
  }
  if (payload.email !== undefined) {
    update.email = payload.email.trim()
  }
  if (payload.status !== undefined) {
    update.status = payload.status
  }
  if (payload.notes !== undefined) {
    update.notes = payload.notes.trim()
  }

  return update
}
