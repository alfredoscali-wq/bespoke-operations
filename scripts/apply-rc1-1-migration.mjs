import { readFileSync } from "fs"
import { resolve } from "path"
import postgres from "postgres"

function loadEnvValue(key) {
  const envPath = resolve(process.cwd(), ".env.local")
  const env = readFileSync(envPath, "utf8")
  const match = env.match(new RegExp(`^${key}=(.+)$`, "m"))
  return match?.[1]?.trim() ?? ""
}

const dbUrl =
  process.env.SUPABASE_DB_URL?.trim() ||
  process.env.DATABASE_URL?.trim() ||
  loadEnvValue("SUPABASE_DB_URL") ||
  loadEnvValue("DATABASE_URL")

if (!dbUrl) {
  console.error(
    [
      "Missing SUPABASE_DB_URL (or DATABASE_URL).",
      "",
      "Add to .env.local the Postgres connection string from:",
      "Supabase Dashboard → Project Settings → Database → Connection string → URI",
      "",
      "Then run: npm run db:rc1-1",
    ].join("\n")
  )
  process.exit(1)
}

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260820000100_customers_operational_rc1_1.sql"
)
const sql = readFileSync(migrationPath, "utf8")

const client = postgres(dbUrl, { max: 1 })

try {
  await client.unsafe(sql)
  console.log("RC1.1 migration applied successfully.")
} finally {
  await client.end({ timeout: 5 })
}
