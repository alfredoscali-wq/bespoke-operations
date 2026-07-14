import { readFileSync, writeFileSync } from "node:fs"

function fixRaises(sql) {
  return sql.replace(
    /RAISE EXCEPTION '([^']+)'\s*\r?\n\s*USING ERRCODE = '([^']+)',\s*\r?\n\s*MESSAGE = '([^']+)';/g,
    (_m, code, errcode, message) =>
      [
        "RAISE EXCEPTION USING",
        `      ERRCODE = '${errcode}',`,
        `      MESSAGE = '${code}: ${message}';`,
      ].join("\n")
  )
}

function extractFunction(sql, name) {
  const re = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`,
    "m"
  )
  const m = sql.match(re)
  return m ? m[0] : null
}

const sources = [
  "supabase/migrations/20261005000100_customer_atenciones_sprint_2_0.sql",
  "supabase/migrations/20261006000100_customer_atenciones_sprint_2_3_shared_management.sql",
  "supabase/migrations/20261011000100_customer_atenciones_sprint_2_8_next_step_restructure.sql",
]

const wanted = [
  "enforce_customer_atenciones_tenant_integrity",
  "enforce_customer_atencion_events_tenant_integrity",
  "start_customer_atencion_management",
  "resolve_customer_atencion_consultation",
  "defer_customer_atencion_consultation",
  "update_customer_atencion_moroso_tracking",
  "link_customer_atencion_to_task",
]

/** @type {Map<string, string>} */
const blocks = new Map()

for (const file of sources) {
  const src = readFileSync(file, "utf8")
  for (const name of wanted) {
    const fn = extractFunction(src, name)
    if (!fn) continue
    blocks.set(name, `-- from ${file}\n${fixRaises(fn)}`)
  }
}

const missing = wanted.filter((name) => !blocks.has(name))
if (missing.length > 0) {
  console.error("Missing functions:", missing)
  process.exit(1)
}

const header = [
  "-- Hotfix: RAISE EXCEPTION ... USING MESSAGE (duplicate MESSAGE option).",
  "-- PostgreSQL treats the RAISE format string as MESSAGE; USING MESSAGE again fails with",
  '-- "RAISE option already specified: MESSAGE".',
  "-- Rewrite to RAISE EXCEPTION USING ERRCODE/MESSAGE only. No business-logic changes.",
  "",
].join("\n")

const body = wanted.map((name) => blocks.get(name)).join("\n\n") + "\n"
const joined = header + body

if (/RAISE EXCEPTION '[A-Z_]+'/.test(joined)) {
  console.error("Broken RAISE pattern still present")
  process.exit(1)
}

const outPath =
  "supabase/migrations/20261013000100_customer_atenciones_raise_message_hotfix.sql"
writeFileSync(outPath, joined)
console.log("Wrote", outPath)
console.log(
  "RAISE EXCEPTION USING count:",
  (joined.match(/RAISE EXCEPTION USING/g) || []).length
)
