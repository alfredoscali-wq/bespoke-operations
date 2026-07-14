import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const __dirname = dirname(fileURLToPath(import.meta.url))
const hotfixPath = join(
  __dirname,
  "../supabase/migrations/20261013000100_customer_atenciones_raise_message_hotfix.sql"
)
const hotfixSql = readFileSync(hotfixPath, "utf8")

test("hotfix redefine defer y triggers afectados", () => {
  assert.match(hotfixSql, /CREATE OR REPLACE FUNCTION public\.defer_customer_atencion_consultation/)
  assert.match(hotfixSql, /CREATE OR REPLACE FUNCTION public\.start_customer_atencion_management/)
  assert.match(
    hotfixSql,
    /CREATE OR REPLACE FUNCTION public\.enforce_customer_atenciones_tenant_integrity/
  )
  assert.match(
    hotfixSql,
    /CREATE OR REPLACE FUNCTION public\.enforce_customer_atencion_events_tenant_integrity/
  )
})

test("hotfix elimina RAISE EXCEPTION 'CODE' USING MESSAGE duplicado", () => {
  assert.doesNotMatch(hotfixSql, /RAISE EXCEPTION '[A-Z_]+'/)
  assert.match(hotfixSql, /RAISE EXCEPTION USING/)
  assert.ok((hotfixSql.match(/RAISE EXCEPTION USING/g) || []).length >= 30)
})

test("mensajes conservan código estabilizado para el mapper TS", () => {
  assert.match(
    hotfixSql,
    /MESSAGE = 'CONSULTATION_NEXT_STEP_REQUIRED: Seleccioná el próximo paso/
  )
  assert.match(
    hotfixSql,
    /MESSAGE = 'CONSULTATION_MANAGEMENT_ACTOR_MISMATCH: Solo quien gestiona/
  )
})
