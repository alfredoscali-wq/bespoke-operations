export {
  isBlank,
  normalizeComparisonKey,
  repairLegacyEncoding,
  trimString,
} from "@/lib/customers/normalization/text"

export {
  LOCALITY_CANONICAL_BY_KEY,
  normalizeLocalityName,
  registerLocalityAlias,
  type NormalizedLocality,
} from "@/lib/customers/normalization/locality"

export {
  normalizePhone,
  normalizePhoneForWhatsApp,
  type NormalizedPhone,
} from "@/lib/customers/normalization/phone"

export { normalizeDni, type NormalizedDni } from "@/lib/customers/normalization/dni"

export {
  isValidEmail,
  normalizeEmail,
  type NormalizedEmail,
} from "@/lib/customers/normalization/email"

export {
  resolveCommercialTechnology,
  resolveImportTechnology,
  type ResolvedCommercialTechnology,
} from "@/lib/customers/normalization/technology"

export {
  resolveImportStatus,
  resolveMigrationStatus,
  resolveValidationStatusFromBucket,
  type CommercialMigrationBucket,
  type CommercialMigrationStatus,
  type CustomerValidationStatus,
  type LegacyClientState,
  type LegacyConnectionState,
  type MigrationStatusResolution,
} from "@/lib/customers/normalization/status"
