import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

import { CUSTOMER_ATENCION_NEXT_STEP_MENU_ORDER } from "../lib/customer-atenciones/format.ts"
import { isCustomerAtencionNextStep } from "../lib/customer-atenciones/consultation.ts"

const __dirname = dirname(fileURLToPath(import.meta.url))
const hotfixPath = join(
  __dirname,
  "../supabase/migrations/20261012000100_customer_atenciones_next_step_check_hotfix.sql"
)
const sprint28Path = join(
  __dirname,
  "../supabase/migrations/20261011000100_customer_atenciones_sprint_2_8_next_step_restructure.sql"
)

const hotfixSql = readFileSync(hotfixPath, "utf8")
const sprint28Sql = readFileSync(sprint28Path, "utf8")

test("hotfix recrea customer_atenciones_next_step_check", () => {
  assert.match(hotfixSql, /DROP CONSTRAINT IF EXISTS customer_atenciones_next_step_check/)
  assert.match(hotfixSql, /ADD CONSTRAINT customer_atenciones_next_step_check/)
})

test("orden: DROP → UPDATE → ADD (sin UPDATE bajo constraint viejo)", () => {
  const firstDrop = hotfixSql.search(
    /DROP CONSTRAINT IF EXISTS customer_atenciones_next_step_check/
  )
  const firstUpdate = hotfixSql.search(/UPDATE public\.customer_atenciones/)
  const firstAdd = hotfixSql.search(
    /ADD CONSTRAINT customer_atenciones_next_step_check/
  )

  assert.ok(firstDrop >= 0)
  assert.ok(firstUpdate > firstDrop)
  assert.ok(firstAdd > firstUpdate)
})

test("constraint permite el vocabulario funcional de la UI", () => {
  for (const value of CUSTOMER_ATENCION_NEXT_STEP_MENU_ORDER) {
    assert.equal(isCustomerAtencionNextStep(value), true)
    assert.match(hotfixSql, new RegExp(`'${value}'`))
  }
})

test("remap de históricos y alias largos hacia slugs canónicos", () => {
  assert.match(hotfixSql, /WHEN 'resolver_facturacion' THEN 'derivar_admin_facturacion'/)
  assert.match(hotfixSql, /WHEN 'facturacion_morosos' THEN 'derivar_admin_morosos'/)
  assert.match(hotfixSql, /WHEN 'analizar_problema_tecnico' THEN 'resolver_consulta_tecnica'/)
  assert.match(hotfixSql, /WHEN 'esperar_administracion' THEN 'derivar_admin_gestion'/)
  assert.match(
    hotfixSql,
    /WHEN 'derivar_administracion_facturacion' THEN 'derivar_admin_facturacion'/
  )
  assert.match(hotfixSql, /WHEN 'derivar_ventas' THEN 'contactar_cliente'/)
})

test("sprint 2.8 ya documentaba el mismo constraint canónico", () => {
  assert.match(sprint28Sql, /customer_atenciones_next_step_check/)
  assert.match(sprint28Sql, /'derivar_admin_facturacion'/)
  assert.match(sprint28Sql, /'contactar_cliente'/)
})
