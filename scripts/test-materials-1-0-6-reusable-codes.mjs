import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  formatDuplicateActiveMaterialCodeMessage,
  hasActiveCatalogCodeConflict,
  mapMaterialCodeErrorMessage,
} from "../lib/materials/material-code.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const reusableCodesSql = read(
  "supabase/migrations/20261149000105_materials_1_0_6_reusable_codes.sql"
)
const materialForm = read("components/materiales/material-form-sheet.tsx")
const photoField = read("components/materiales/material-photo-field.tsx")
const queries = read("lib/supabase/materials.queries.ts")

const sampleCatalogItem = (id, code, active = true) => ({
  id,
  companyId: "c-1",
  code,
  name: `Material ${code}`,
  category: "consumables",
  itemType: "consumable",
  unit: "un",
  minStock: 0,
  manufacturer: "",
  description: "",
  active,
  photoAttachmentId: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
})

test("1. Migración: código único solo entre materiales activos", () => {
  assert.match(reusableCodesSql, /DROP CONSTRAINT IF EXISTS materials_company_code_unique/)
  assert.match(
    reusableCodesSql,
    /materials_company_active_code_unique/
  )
  assert.match(reusableCodesSql, /WHERE active = true/)
  assert.match(reusableCodesSql, /CREATE OR REPLACE FUNCTION public\.create_material/)
  assert.match(
    reusableCodesSql,
    /Ya existe un material activo con el código %/
  )
  assert.match(reusableCodesSql, /AND active = true/)
})

test("2. Reutilizar código tras eliminación lógica (inactivo no bloquea)", () => {
  const catalog = [
    sampleCatalogItem("m-old", "FO-12", false),
    sampleCatalogItem("m-other", "AB-01", true),
  ]

  assert.equal(hasActiveCatalogCodeConflict(catalog, "FO-12"), false)
  assert.equal(hasActiveCatalogCodeConflict(catalog, "AB-01"), true)
})

test("3. Rechazar código duplicado entre materiales activos", () => {
  const catalog = [sampleCatalogItem("m-1", "FO-12", true)]

  assert.equal(hasActiveCatalogCodeConflict(catalog, "FO-12"), true)
  assert.equal(
    formatDuplicateActiveMaterialCodeMessage("FO-12"),
    "Ya existe un material activo con el código FO-12. Buscálo en el catálogo y registrá el stock mediante Entrada."
  )
})

test("4. Mensaje amigable para error de constraint/BD", () => {
  const raw =
    'duplicate key value violates unique constraint "materials_company_active_code_unique"'
  const mapped = mapMaterialCodeErrorMessage(raw)
  assert.match(mapped, /Ya existe un material activo/)
  assert.match(mapped, /Buscálo en el catálogo/)

  const rpc =
    "Ya existe un material activo con el código FO-12. Buscálo en el catálogo y registrá el stock mediante Entrada."
  assert.equal(mapMaterialCodeErrorMessage(rpc), rpc)
})

test("5. Foto seleccionable antes del alta", () => {
  assert.match(photoField, /pendingFile/)
  assert.match(photoField, /onPendingFileChange/)
  assert.match(photoField, /Seleccionar foto/)
  assert.doesNotMatch(
    photoField,
    /Guarde el material primero para asociar una foto/
  )
  assert.match(materialForm, /pendingPhotoFile/)
  assert.match(materialForm, /uploadPendingPhoto/)
  assert.match(materialForm, /uploadAttachmentFile/)
  assert.match(materialForm, /El material fue creado, pero la foto no pudo asociarse/)
  assert.match(materialForm, /reintentar desde Editar material/)
})

test("6. Validación de código en frontend y backend", () => {
  assert.match(materialForm, /hasActiveCatalogCodeConflict/)
  assert.match(materialForm, /formatDuplicateActiveMaterialCodeMessage/)
  assert.match(materialForm, /mapMaterialCodeErrorMessage/)
  assert.match(queries, /mapMaterialCodeErrorMessage/)
  assert.match(materialForm, /activeCatalog/)
})
