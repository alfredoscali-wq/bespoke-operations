import {
  ARGENTINA_PROVINCES,
  ISP_BILLING_ADDRESS_REQUIRED_MESSAGE,
  ISP_BILLING_ARCA_PENDING_LABEL,
  ISP_BILLING_COMPANY_READY_LABEL,
  ISP_BILLING_CROSS_COMPANY_MESSAGE,
  ISP_BILLING_CUIT_INVALID_MESSAGE,
  ISP_BILLING_CUIT_REQUIRED_MESSAGE,
  ISP_BILLING_DOCUMENT_TYPES,
  ISP_BILLING_INCOMPLETE_LABEL,
  ISP_BILLING_LEGAL_NAME_REQUIRED_MESSAGE,
  ISP_BILLING_LOGO_MAX_BYTES,
  ISP_BILLING_LOGO_MIME_TYPES,
  ISP_BILLING_NON_FISCAL_DOCUMENT_TYPES,
  ISP_BILLING_POS_DUPLICATE_MESSAGE,
  ISP_BILLING_POS_INVALID_ACTIVE_MESSAGE,
  ISP_BILLING_POS_NUMBER_INVALID_MESSAGE,
  ISP_BILLING_POS_READY_LABEL,
  ISP_BILLING_POS_REQUIRED_MESSAGE,
  ISP_BILLING_SEQUENCE_LOCKED_MESSAGE,
  ISP_BILLING_SIRO_PENDING_LABEL,
  ISP_BILLING_VAT_CONDITIONS,
  ISP_BILLING_VAT_REQUIRED_MESSAGE,
  type IspBillingDocumentType,
  type IspBillingIntegrationStatus,
  type IspBillingVatCondition,
} from "@/lib/isp/billing-constants"
import type {
  IspBillingCompanySettings,
  IspBillingCompanySettingsDraft,
  IspBillingConfigurationStatus,
  IspBillingDocumentSequence,
  IspBillingDocumentSequenceDraft,
  IspBillingIntegration,
  IspBillingMissingField,
  IspBillingPointOfSale,
  IspBillingPointOfSaleDraft,
} from "@/lib/isp/billing-types"
import {
  DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS,
  ISP_BILLING_LOGO_URL_INVALID_MESSAGE,
  isAllowedBillingLogoUrl,
  parseIspBillingTemplateSettings,
  validateIspBillingTemplateSettingsInput,
} from "@/lib/isp/billing-template-settings"

const CUIT_MULTIPLIERS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const

export function normalizeCuitDigits(value: string): string {
  return value.replace(/\D/g, "")
}

export function formatCuit(value: string): string {
  const digits = normalizeCuitDigits(value)
  if (digits.length !== 11) return value.trim()
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`
}

export function isValidArCuit(value: string): boolean {
  const digits = normalizeCuitDigits(value)
  if (digits.length !== 11) return false
  if (!/^\d{11}$/.test(digits)) return false

  let total = 0
  for (let index = 0; index < 10; index += 1) {
    total += Number(digits[index]) * CUIT_MULTIPLIERS[index]
  }

  let check = 11 - (total % 11)
  if (check === 11) check = 0
  if (check === 10) check = 9
  return check === Number(digits[10])
}

export function isIspBillingVatCondition(
  value: string
): value is IspBillingVatCondition {
  return (ISP_BILLING_VAT_CONDITIONS as readonly string[]).includes(value)
}

export function isIspBillingDocumentType(
  value: string
): value is IspBillingDocumentType {
  return (ISP_BILLING_DOCUMENT_TYPES as readonly string[]).includes(value)
}

export function isFiscalBillingDocument(type: IspBillingDocumentType): boolean {
  return !(ISP_BILLING_NON_FISCAL_DOCUMENT_TYPES as readonly string[]).includes(
    type
  )
}

export function parsePointOfSaleNumber(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const parsed = Number(trimmed)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 99999) return null
  return parsed
}

export function canAccessBillingCompany(
  sessionCompanyId: string,
  rowCompanyId: string | null | undefined
): boolean {
  return Boolean(
    sessionCompanyId.trim() &&
      rowCompanyId &&
      sessionCompanyId === rowCompanyId
  )
}

export function billingCrossCompanyError(): string {
  return ISP_BILLING_CROSS_COMPANY_MESSAGE
}

export function canEditDocumentSequence(issuedCount: number): boolean {
  return issuedCount <= 0
}

export function isValidBillingEmail(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
}

export function isAllowedBillingLogoFile(input: {
  mimeType: string
  size: number
}): boolean {
  return (
    (ISP_BILLING_LOGO_MIME_TYPES as readonly string[]).includes(input.mimeType) &&
    input.size > 0 &&
    input.size <= ISP_BILLING_LOGO_MAX_BYTES
  )
}

export function emptyBillingDraft(): IspBillingCompanySettingsDraft {
  return {
    legalName: "",
    taxId: "",
    vatCondition: "",
    taxAddress: "",
    city: "",
    province: "",
    postalCode: "",
    phone: "",
    email: "",
    website: "",
    logoUrl: "",
    templateSettings: { ...DEFAULT_ISP_BILLING_TEMPLATE_SETTINGS },
    pointOfSale: {
      number: "1",
      description: "Punto de venta principal",
      active: true,
    },
    sequences: ISP_BILLING_DOCUMENT_TYPES.map((documentType) => ({
      documentType,
      nextNumber: "1",
    })),
  }
}

export function settingsToDraft(
  settings: IspBillingCompanySettings | null
): IspBillingCompanySettingsDraft {
  const base = emptyBillingDraft()
  if (!settings) return base

  const sequenceByType = new Map(
    settings.sequences.map((item) => [item.documentType, item])
  )

  return {
    legalName: settings.legalName,
    taxId: formatCuit(settings.taxId),
    vatCondition: settings.vatCondition ?? "",
    taxAddress: settings.taxAddress,
    city: settings.city,
    province: settings.province,
    postalCode: settings.postalCode,
    phone: settings.phone,
    email: settings.email,
    website: settings.website,
    logoUrl: settings.logoUrl ?? "",
    templateSettings: parseIspBillingTemplateSettings(settings.templateSettings),
    pointOfSale: settings.pointOfSale
      ? {
          id: settings.pointOfSale.id,
          number: String(settings.pointOfSale.number),
          description: settings.pointOfSale.description,
          active: settings.pointOfSale.active,
        }
      : base.pointOfSale,
    sequences: ISP_BILLING_DOCUMENT_TYPES.map((documentType) => {
      const existing = sequenceByType.get(documentType)
      return {
        documentType,
        nextNumber: String(existing?.nextNumber ?? 1),
      }
    }),
  }
}

export type BillingValidationIssue = {
  field: string
  message: string
}

export function validatePointOfSaleDraft(
  draft: IspBillingPointOfSaleDraft,
  existingNumbers: readonly number[] = []
): BillingValidationIssue[] {
  const issues: BillingValidationIssue[] = []
  const number = parsePointOfSaleNumber(draft.number)

  if (number == null) {
    issues.push({
      field: "pointOfSale.number",
      message: ISP_BILLING_POS_NUMBER_INVALID_MESSAGE,
    })
  } else if (existingNumbers.includes(number)) {
    issues.push({
      field: "pointOfSale.number",
      message: ISP_BILLING_POS_DUPLICATE_MESSAGE,
    })
  }

  if (draft.active && number == null) {
    issues.push({
      field: "pointOfSale.active",
      message: ISP_BILLING_POS_INVALID_ACTIVE_MESSAGE,
    })
  }

  return issues
}

export function validateDocumentSequences(input: {
  drafts: readonly IspBillingDocumentSequenceDraft[]
  existing: readonly IspBillingDocumentSequence[]
}): BillingValidationIssue[] {
  const issues: BillingValidationIssue[] = []
  const existingByType = new Map(
    input.existing.map((item) => [item.documentType, item])
  )

  for (const draft of input.drafts) {
    if (!isIspBillingDocumentType(draft.documentType)) {
      issues.push({
        field: "sequences",
        message: "Tipo de comprobante inválido.",
      })
      continue
    }

    const nextNumber = Number(draft.nextNumber)
    if (!Number.isInteger(nextNumber) || nextNumber < 1) {
      issues.push({
        field: `sequences.${draft.documentType}`,
        message: "El próximo número debe ser un entero mayor a 0.",
      })
      continue
    }

    const existing = existingByType.get(draft.documentType)
    if (
      existing &&
      !canEditDocumentSequence(existing.issuedCount) &&
      existing.nextNumber !== nextNumber
    ) {
      issues.push({
        field: `sequences.${draft.documentType}`,
        message: ISP_BILLING_SEQUENCE_LOCKED_MESSAGE,
      })
    }
  }

  return issues
}

export function validateBillingCompanyDraft(
  draft: IspBillingCompanySettingsDraft,
  options?: {
    existingPosNumbers?: readonly number[]
    existingSequences?: readonly IspBillingDocumentSequence[]
  }
): BillingValidationIssue[] {
  const issues: BillingValidationIssue[] = []

  if (!draft.legalName.trim()) {
    issues.push({
      field: "legalName",
      message: ISP_BILLING_LEGAL_NAME_REQUIRED_MESSAGE,
    })
  }

  const taxId = draft.taxId.trim()
  if (!taxId) {
    issues.push({
      field: "taxId",
      message: ISP_BILLING_CUIT_REQUIRED_MESSAGE,
    })
  } else if (!isValidArCuit(taxId)) {
    issues.push({
      field: "taxId",
      message: ISP_BILLING_CUIT_INVALID_MESSAGE,
    })
  }

  if (!draft.vatCondition || !isIspBillingVatCondition(draft.vatCondition)) {
    issues.push({
      field: "vatCondition",
      message: ISP_BILLING_VAT_REQUIRED_MESSAGE,
    })
  }

  if (!draft.taxAddress.trim()) {
    issues.push({
      field: "taxAddress",
      message: ISP_BILLING_ADDRESS_REQUIRED_MESSAGE,
    })
  }

  if (
    draft.province &&
    !(ARGENTINA_PROVINCES as readonly string[]).includes(draft.province)
  ) {
    issues.push({
      field: "province",
      message: "La provincia no es válida.",
    })
  }

  if (!isValidBillingEmail(draft.email)) {
    issues.push({
      field: "email",
      message: "El email no es válido.",
    })
  }

  if (!isAllowedBillingLogoUrl(draft.logoUrl)) {
    issues.push({
      field: "logoUrl",
      message: ISP_BILLING_LOGO_URL_INVALID_MESSAGE,
    })
  }

  issues.push(...validateIspBillingTemplateSettingsInput(draft.templateSettings))

  issues.push(
    ...validatePointOfSaleDraft(
      draft.pointOfSale,
      options?.existingPosNumbers ?? []
    )
  )
  issues.push(
    ...validateDocumentSequences({
      drafts: draft.sequences,
      existing: options?.existingSequences ?? [],
    })
  )

  return issues
}

export function pickPrimaryPointOfSale(
  rows: readonly IspBillingPointOfSale[]
): IspBillingPointOfSale | null {
  return rows.find((row) => row.active) ?? rows[0] ?? null
}

export function findDuplicatePosNumber(input: {
  companyId: string
  number: number
  currentId?: string
  existing: readonly Pick<IspBillingPointOfSale, "id" | "companyId" | "number">[]
}): boolean {
  return input.existing.some(
    (row) =>
      row.companyId === input.companyId &&
      row.number === input.number &&
      row.id !== input.currentId
  )
}

export function integrationStatus(
  integrations: readonly IspBillingIntegration[],
  provider: "arca" | "siro"
): IspBillingIntegrationStatus {
  return (
    integrations.find((item) => item.provider === provider)?.status ??
    "not_configured"
  )
}

export function buildBillingConfigurationStatus(input: {
  settings: Pick<
    IspBillingCompanySettings,
    "legalName" | "taxId" | "vatCondition" | "taxAddress" | "pointOfSale" | "integrations"
  > | null
}): IspBillingConfigurationStatus {
  const missing: IspBillingMissingField[] = []
  const settings = input.settings

  if (!settings?.legalName.trim()) {
    missing.push({
      code: "legal_name",
      message: ISP_BILLING_LEGAL_NAME_REQUIRED_MESSAGE,
    })
  }
  if (!settings?.taxId.trim()) {
    missing.push({
      code: "tax_id",
      message: ISP_BILLING_CUIT_REQUIRED_MESSAGE,
    })
  } else if (!isValidArCuit(settings.taxId)) {
    missing.push({
      code: "tax_id",
      message: ISP_BILLING_CUIT_INVALID_MESSAGE,
    })
  }
  if (!settings?.vatCondition) {
    missing.push({
      code: "vat_condition",
      message: ISP_BILLING_VAT_REQUIRED_MESSAGE,
    })
  }
  if (!settings?.taxAddress.trim()) {
    missing.push({
      code: "tax_address",
      message: ISP_BILLING_ADDRESS_REQUIRED_MESSAGE,
    })
  }

  const posNumber = settings?.pointOfSale?.number ?? null
  const posReady = Boolean(
    settings?.pointOfSale?.active &&
      posNumber != null &&
      posNumber >= 1
  )
  if (!posReady) {
    missing.push({
      code: "point_of_sale",
      message: ISP_BILLING_POS_REQUIRED_MESSAGE,
    })
  }

  const companyReady = !missing.some(
    (item) =>
      item.code === "legal_name" ||
      item.code === "tax_id" ||
      item.code === "vat_condition" ||
      item.code === "tax_address"
  )
  const arcaStatus = integrationStatus(settings?.integrations ?? [], "arca")
  const siroStatus = integrationStatus(settings?.integrations ?? [], "siro")

  return {
    companyReady,
    pointOfSaleReady: posReady,
    arcaStatus,
    siroStatus,
    incomplete: missing.length > 0,
    missing,
    labels: {
      company: companyReady
        ? ISP_BILLING_COMPANY_READY_LABEL
        : ISP_BILLING_INCOMPLETE_LABEL,
      pointOfSale: posReady
        ? ISP_BILLING_POS_READY_LABEL
        : ISP_BILLING_POS_REQUIRED_MESSAGE,
      arca:
        arcaStatus === "connected"
          ? "ARCA conectado"
          : ISP_BILLING_ARCA_PENDING_LABEL,
      siro:
        siroStatus === "connected"
          ? "SIRO conectado"
          : ISP_BILLING_SIRO_PENDING_LABEL,
    },
  }
}

export function ignoreClientCompanyId(
  sessionCompanyId: string,
  bodyCompanyId: string | null | undefined
): string {
  void bodyCompanyId
  return sessionCompanyId
}
