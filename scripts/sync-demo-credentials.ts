import { readFileSync } from "fs"
import { resolve } from "path"

import { createClient } from "@supabase/supabase-js"

import { ensureDemoAdminAccount } from "@/lib/demo/ensure-demo-admin-account"
import { ensureDemoOperarioAccount } from "@/lib/demo/ensure-demo-operario-account"
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

  const webPassword = env.match(/^DEMO_WEB_PASSWORD=(.+)$/m)?.[1]?.trim()
  const mobilePassword = env.match(/^DEMO_MOBILE_PASSWORD=(.+)$/m)?.[1]?.trim()
  if (webPassword) {
    process.env.DEMO_WEB_PASSWORD = webPassword
  }
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
    .select("id, mobile_code")
    .eq("id", BESPOKE_PRODUCTION_COMPANY_ID)
    .maybeSingle()

  if (productionError) {
    throw new Error(productionError.message)
  }

  const admin = await ensureDemoAdminAccount(supabase)
  const operario = await ensureDemoOperarioAccount(supabase)

  const { data: productionAfter } = await supabase
    .from("companies")
    .select("id, mobile_code")
    .eq("id", BESPOKE_PRODUCTION_COMPANY_ID)
    .maybeSingle()

  if (
    (productionAfter?.mobile_code ?? null) !==
    (productionBefore?.mobile_code ?? null)
  ) {
    throw new Error("ABNet mobile_code changed.")
  }

  console.log("Demo credentials synced (passwords from env).")
  console.log("admin", admin.authUserId, "created", admin.created)
  console.log("operario", operario.authUserId, "created", operario.created)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
