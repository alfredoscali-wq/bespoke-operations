import fs from "node:fs"
import path from "node:path"

import type { CommercialMigrationDataset } from "@/lib/customers/commercial-migration/types"
import type {
  MigrationReviewAction,
  MigrationReviewState,
} from "@/lib/customers/commercial-migration/review-types"

const DATA_DIR = path.join(process.cwd(), "data")
const DATASET_FILE = path.join(DATA_DIR, "rc1-1b-prepared-dataset.json")
const REVIEW_STATE_FILE = path.join(
  DATA_DIR,
  "rc1-1b-migration-review-state.json"
)

export function getMigrationDatasetPath(): string {
  return DATASET_FILE
}

export function readPreparedMigrationDataset(): CommercialMigrationDataset {
  if (!fs.existsSync(DATASET_FILE)) {
    throw new Error(
      "Dataset RC1.1B no encontrado. Ejecute scripts/prepare-commercial-migration.ts"
    )
  }

  const raw = fs.readFileSync(DATASET_FILE, "utf8")
  return JSON.parse(raw) as CommercialMigrationDataset
}

export function readMigrationReviewState(): MigrationReviewState {
  if (!fs.existsSync(REVIEW_STATE_FILE)) {
    return {
      updatedAt: new Date().toISOString(),
      decisions: {},
    }
  }

  return JSON.parse(fs.readFileSync(REVIEW_STATE_FILE, "utf8")) as MigrationReviewState
}

export function writeMigrationReviewState(state: MigrationReviewState): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true })
  }

  fs.writeFileSync(REVIEW_STATE_FILE, JSON.stringify(state, null, 2), "utf8")
}

export function upsertMigrationReviewDecision(input: {
  legacyId: number
  action: MigrationReviewAction | null
}): MigrationReviewState {
  const current = readMigrationReviewState()
  const key = String(input.legacyId)

  if (input.action === null) {
    delete current.decisions[key]
  } else {
    current.decisions[key] = {
      legacyId: input.legacyId,
      action: input.action,
      reviewedAt: new Date().toISOString(),
    }
  }

  current.updatedAt = new Date().toISOString()
  writeMigrationReviewState(current)
  return current
}
