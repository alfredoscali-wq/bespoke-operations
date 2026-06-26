import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { resolve } from "path"

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local")
  const env = readFileSync(envPath, "utf8")
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim()
  const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim()

  if (!url || !key) {
    throw new Error("Missing Supabase env in .env.local")
  }

  return { url, key }
}

const { url, key } = loadEnv()
const supabase = createClient(url, key)

const probe = await supabase
  .from("customers")
  .select("id, validation_status, legacy_migration_id")
  .limit(1)

console.log(
  JSON.stringify(
    {
      probe: {
        data: probe.data,
        error: probe.error?.message,
        code: probe.error?.code,
      },
    },
    null,
    2
  )
)

const { count } = await supabase
  .from("customers")
  .select("id", { count: "exact", head: true })

console.log(JSON.stringify({ existingCustomers: count ?? 0 }, null, 2))
