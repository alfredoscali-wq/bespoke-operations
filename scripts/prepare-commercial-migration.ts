/**
 * RC1.1B / RC1.1D-A — Genera dataset preparado desde dump comercial (sin escribir en Supabase).
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { buildCommercialMigrationFromDumpFile } from "../lib/customers/commercial-migration/build-dataset"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, "..")
const DUMP_PATH = path.join(ROOT, "data", "sistema-comercial.sql")
const DATASET_PATH = path.join(ROOT, "data", "rc1-1b-prepared-dataset.json")
const REPORT_PATH = path.join(ROOT, "data", "rc1-1b-migration-report.json")
const AUDIT_PATH = path.join(ROOT, "data", "rc1-1d-b-audit-report.json")

function main() {
  if (!fs.existsSync(DUMP_PATH)) {
    console.error(`Dump no encontrado: ${DUMP_PATH}`)
    process.exit(1)
  }

  const sqlContent = fs.readFileSync(DUMP_PATH, "utf8")
  const { dataset, report, auditReport } = buildCommercialMigrationFromDumpFile({
    dumpPath: DUMP_PATH,
    sqlContent,
  })

  fs.writeFileSync(DATASET_PATH, JSON.stringify(dataset, null, 2), "utf8")
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8")
  fs.writeFileSync(AUDIT_PATH, JSON.stringify(auditReport, null, 2), "utf8")

  console.log(JSON.stringify(report, null, 2))
  console.error(`\nDataset: ${DATASET_PATH}`)
  console.error(`Informe: ${REPORT_PATH}`)
  console.error(`Auditoría RC1.1D-B: ${AUDIT_PATH}`)
}

main()
