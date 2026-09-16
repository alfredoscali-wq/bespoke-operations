import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local")
  const env = readFileSync(envPath, "utf8")
  const url = env.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim()
  const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim()
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  }
  return { url, key }
}

function arg(name) {
  const prefix = `--${name}=`
  const found = process.argv.find((value) => value.startsWith(prefix))
  return found ? found.slice(prefix.length) : null
}

const companyId = arg("company-id")
const logoUrl = arg("logo-url")
const primaryColor = arg("primary")
const secondaryColor = arg("secondary")

if (!companyId || !logoUrl || !primaryColor || !secondaryColor) {
  throw new Error(
    "Usage: node --env-file=.env.local scripts/upsert-company-branding.mjs --company-id=UUID --logo-url=URL --primary=#RRGGBB --secondary=#RRGGBB"
  )
}

const { url, key } = loadEnv()
const client = createClient(url, key, { auth: { persistSession: false } })
const { data, error } = await client
  .from("company_branding")
  .upsert(
    {
      company_id: companyId,
      logo_url: logoUrl,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
    },
    { onConflict: "company_id" }
  )
  .select("company_id, logo_url, primary_color, secondary_color")
  .single()

if (error) {
  throw error
}

console.log(JSON.stringify(data, null, 2))
