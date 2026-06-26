export type {
  CommercialMigrationBucket,
  CommercialMigrationStatus,
  LegacyClientState,
  LegacyConnectionState,
  MigrationStatusResolution,
} from "@/lib/customers/normalization/status"

export type {
  CommercialMigrationDataset,
  CommercialMigrationReport,
  DuplicateMatch,
  DuplicateMatchKind,
  LegacyClientRow,
  LegacyConnectionRow,
  PreparedCommercialCustomer,
} from "@/lib/customers/commercial-migration/types"

export {
  parseLegacyClientRow,
  parseLegacyConnectionRow,
  parseMysqlInsertLine,
  loadLegacyTablesFromDump,
} from "@/lib/customers/commercial-migration/dump-parser"

export {
  attachDuplicateFlagsToRecords,
  detectLegacyDuplicateGroups,
  hasMinimumContactData,
  isTestClientName,
  observationMentionsBaja,
} from "@/lib/customers/commercial-migration/duplicate-detection"

export { prepareLegacyCustomerRecord } from "@/lib/customers/commercial-migration/prepare-record"

export {
  buildCommercialMigrationDataset,
  buildCommercialMigrationFromDumpFile,
  buildCommercialMigrationReport,
} from "@/lib/customers/commercial-migration/build-dataset"

export type {
  MigrationReviewAction,
  MigrationReviewDecision,
  MigrationReviewState,
  EnrichedMigrationCustomer,
  MigrationReviewFilters,
  MigrationReviewKpiFilter,
  MigrationReviewQuickFilter,
} from "@/lib/customers/commercial-migration/review-types"

export { defaultMigrationReviewFilters } from "@/lib/customers/commercial-migration/review-types"

export {
  enrichMigrationCustomer,
  enrichMigrationCustomers,
  countMigrationReviewKpis,
  filterMigrationReviewRecords,
  resolveEffectiveBucket,
  buildMigrationDataQuality,
  getMigrationReviewPrimaryReason,
  MIGRATION_BUCKET_LABELS,
  MIGRATION_STATUS_LABELS,
  DUPLICATE_KIND_LABELS,
  MIGRATION_REVIEW_KPI_LABELS,
  MIGRATION_REVIEW_QUICK_FILTER_LABELS,
} from "@/lib/customers/commercial-migration/review-utils"

export { executeCommercialMigrationImport } from "@/lib/customers/commercial-migration/execute-import"

export { exportMigrationRecordsToXlsx } from "@/lib/customers/commercial-migration/review-export"
