import { readFileSync } from "fs"
import { resolve } from "path"

import { createClient } from "@supabase/supabase-js"

import { BESPOKE_DEMO_COMPANY_NAME } from "@/lib/demo/constants"
import { prepareDemoMobileTenant } from "@/lib/demo/prepare-demo-mobile-tenant"
import { BESPOKE_PRODUCTION_COMPANY_ID } from "@/lib/supabase/company.constants"
import type { Database } from "@/lib/supabase/database.types"

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local")
  const env = readFileSync(envPath, "utf8")
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim()
  const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim()

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    )
  }

  const mobilePassword = env.match(/^DEMO_MOBILE_PASSWORD=(.+)$/m)?.[1]?.trim()
  if (mobilePassword) {
    process.env.DEMO_MOBILE_PASSWORD = mobilePassword
  }

  return { url, key }
}

async function main() {
  const { url, key } = loadEnv()
  const supabase = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: productionBefore, error: productionError } = await supabase
    .from("companies")
    .select("id, name, mobile_code")
    .eq("id", BESPOKE_PRODUCTION_COMPANY_ID)
    .maybeSingle()

  if (productionError) {
    throw new Error(productionError.message)
  }

  console.log("Preparing Bespoke Demo Mobile overlay (Demo tenant only)…")
  const result = await prepareDemoMobileTenant(supabase)

  const { data: productionAfter } = await supabase
    .from("companies")
    .select("id, name, mobile_code")
    .eq("id", BESPOKE_PRODUCTION_COMPANY_ID)
    .maybeSingle()

  if (
    (productionAfter?.mobile_code ?? null) !==
    (productionBefore?.mobile_code ?? null)
  ) {
    throw new Error("ABNet mobile_code changed. Seed aborted after the fact.")
  }

  console.log("\nDemo Mobile overlay completed.")
  console.log(`Company: ${BESPOKE_DEMO_COMPANY_NAME} (${result.companyId})`)
  console.log(`mobile_code: ${result.mobileCode}`)
  console.log(`Operario: ${result.operarioEmployeeId}`)
  console.log(`Crew: ${result.crewId}`)
  console.log(`Device: ${result.deviceId} (${result.deviceRecordId})`)
  console.log(`OT: ${result.taskCodes.join(", ")}`)
  console.log(`ABNet untouched: ${BESPOKE_PRODUCTION_COMPANY_ID}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
