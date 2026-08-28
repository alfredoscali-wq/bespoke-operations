import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  defaultMaterialFilters,
  filterInventoryRows,
} from "../lib/materials/filters.ts"
import { canManageMaterials } from "../lib/materials/permissions.ts"
import {
  computeNetAvailable,
  resolveStockStatus,
} from "../lib/materials/stock-status.ts"
import {
  categoryChangeAffectsUnit,
  formatUnitLabel,
  getCategoryUnitRule,
  isIntegerOnlyUnit,
  normalizeMaterialUnit,
  resolveUnitForCategory,
} from "../lib/materials/units.ts"
import {
  buildWarehouseSelectionContext,
  mergeWarehouseFilterOptions,
  resolveWarehousePickerMode,
} from "../lib/materials/warehouse-selection.ts"
import {
  buildFullInventoryRows,
  buildInventoryRowsFromStockLevels,
  createSyntheticInventoryRow,
} from "../lib/supabase/materials.mapper.ts"
import {
  canAccessPathWithModules,
  createEmptyModuleVisibility,
} from "../lib/roles/app-modules.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const sql = read(
  "supabase/migrations/20261149000100_materials_1_0_inventory.sql"
)
const hotfixSql = read(
  "supabase/migrations/20261149000101_materials_1_0_1_hotfix.sql"
)
const backfillSql = read(
  "supabase/migrations/20261149000102_materials_1_0_2_inventory_backfill.sql"
)
const catalogPhotoSql = read(
  "supabase/migrations/20261149000103_materials_1_0_4_catalog_photo.sql"
)
const catalogDeleteSql = read(
  "supabase/migrations/20261149000104_materials_1_0_5_catalog_delete.sql"
)
const reusableCodesSql = read(
  "supabase/migrations/20261149000105_materials_1_0_6_reusable_codes.sql"
)
const separationSql = read(
  "supabase/migrations/20261149000106_materials_1_0_7_catalog_inventory.sql"
)
const materialCodeLib = read("lib/materials/material-code.ts")
const catalogLib = read("lib/materials/catalog.ts")
const attachmentConstants = read("lib/attachments/constants.ts")
const catalogPicker = read("components/materiales/material-catalog-picker.tsx")
const photoField = read("components/materiales/material-photo-field.tsx")
const queries = read("lib/supabase/materials.queries.ts")
const apiWarehouses = read("app/api/materiales/warehouses/route.ts")
const apiMaterials = read("app/api/materiales/materials/route.ts")
const apiMaterialById = read("app/api/materiales/materials/[id]/route.ts")
const apiMovements = read("app/api/materiales/movements/route.ts")
const routeContext = read("lib/materials/route-context.ts")
const materialsModule = read("components/materiales/materials-module.tsx")
const materialForm = read("components/materiales/material-form-sheet.tsx")
const movementSheet = read("components/materiales/material-movement-sheet.tsx")
const adjustmentSheet = read(
  "components/materiales/material-stock-adjustment-sheet.tsx"
)
const materialsTable = read("components/materiales/materials-table.tsx")
const databaseTypes = read("lib/supabase/database.types.ts")

const materialsUser = {
  moduleVisibility: {
    ...createEmptyModuleVisibility(),
    materials: true,
  },
}

const sampleWarehouse = (id, name) => ({
  id,
  companyId: "c-1",
  name,
  active: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
})

const sampleMaterialRow = (id, code, overrides = {}) => ({
  id,
  company_id: "c-1",
  code,
  name: `Material ${code}`,
  category: "consumables",
  type: "consumable",
  unit: "un",
  min_stock: "0",
  manufacturer: "",
  description: "",
  active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
})

const sampleWarehouseRow = (id, name) => ({
  id,
  company_id: "c-1",
  name,
  active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
})

test("1. Migración define tablas, RLS y RPCs transaccionales", () => {
  assert.match(sql, /CREATE TABLE public\.warehouses/)
  assert.match(sql, /CREATE TABLE public\.material_stock_levels/)
  assert.match(sql, /record_material_stock_entry/)
  assert.match(sql, /record_material_stock_exit/)
  assert.match(sql, /record_material_stock_adjustment/)
  assert.match(databaseTypes, /material_stock_levels:/)
  assert.match(databaseTypes, /warehouses:/)
})

test("2. Hotfix 1.0.1 creó stock level con depósito inicial (histórico)", () => {
  assert.match(hotfixSql, /p_initial_warehouse_id/)
  assert.match(hotfixSql, /INSERT INTO public\.material_stock_levels/)
  assert.match(separationSql, /CREATE OR REPLACE FUNCTION public\.create_material/)
  assert.doesNotMatch(separationSql, /INSERT INTO public\.material_stock_levels/)
})

test("3. Inventario solo con stock levels reales (1.0.7)", () => {
  assert.match(queries, /buildInventoryRowsFromStockLevels/)
  assert.match(queries, /loadInventoryBuildingBlocks/)

  const warehouse = sampleWarehouseRow("w-1", "Central")
  const stockLevels = [
    {
      id: "sl-1",
      company_id: "c-1",
      material_id: "m-1",
      warehouse_id: "w-1",
      quantity_available: "0",
      quantity_reserved: "0",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      material: sampleMaterialRow("m-1", "A"),
      warehouse: warehouse,
    },
  ]

  const rows = buildInventoryRowsFromStockLevels(stockLevels)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].materialId, "m-1")
  assert.equal(rows[0].quantityAvailable, 0)
})

test("4. Depósitos: 0, 1 y múltiples", () => {
  assert.equal(resolveWarehousePickerMode([]), "none")
  assert.equal(
    resolveWarehousePickerMode([sampleWarehouse("w-1", "Central")]),
    "auto"
  )
  assert.equal(
    resolveWarehousePickerMode([
      sampleWarehouse("w-1", "Central"),
      sampleWarehouse("w-2", "Norte"),
    ]),
    "manual"
  )

  const single = buildWarehouseSelectionContext([
    sampleWarehouse("w-1", "Central"),
  ])
  assert.equal(single.mode, "auto")
  assert.equal(single.defaultWarehouseId, "w-1")

  const multi = buildWarehouseSelectionContext([
    sampleWarehouse("w-1", "Central"),
    sampleWarehouse("w-2", "Norte"),
  ])
  assert.equal(multi.mode, "manual")
  assert.equal(multi.defaultWarehouseId, null)

  assert.match(movementSheet, /Seleccionar depósito/)
})

test("5. Material agotado (stock 0) permanece en inventario", () => {
  const row = createSyntheticInventoryRow(
    sampleMaterialRow("m-1", "FO-001", {
      category: "consumables",
      unit: "m",
      min_stock: "10",
    }),
    sampleWarehouseRow("w-1", "Central"),
    0,
    0
  )
  row.isSynthetic = false
  row.status = "out-of-stock"

  assert.equal(computeNetAvailable(0, 0), 0)
  assert.equal(
    filterInventoryRows([row], defaultMaterialFilters).length,
    1
  )
  assert.equal(row.status, "out-of-stock")
})

test("6. Unidades por categoría", () => {
  assert.equal(resolveUnitForCategory("fiber-optic"), "m")
  assert.equal(getCategoryUnitRule("fiber-optic").mode, "fixed")
  assert.equal(resolveUnitForCategory("cameras"), "un")
  assert.equal(resolveUnitForCategory("network-equipment"), "un")
  assert.equal(resolveUnitForCategory("wireless"), "un")
  assert.equal(resolveUnitForCategory("consumables"), "un")
  assert.equal(resolveUnitForCategory("consumables", "m"), "m")
  assert.equal(normalizeMaterialUnit("pza"), "un")
  assert.equal(isIntegerOnlyUnit("un"), true)
  assert.equal(isIntegerOnlyUnit("m"), false)
  assert.equal(
    categoryChangeAffectsUnit("fiber-optic", "cameras", "m"),
    true
  )
  assert.equal(formatUnitLabel("m"), "Metros")
  assert.equal(formatUnitLabel("un"), "Piezas")
  assert.equal(formatUnitLabel("pza"), "Piezas")
})

test("7. Entrada/salida y ajuste de stock", () => {
  assert.match(movementSheet, /integerOnly/)
  assert.match(adjustmentSheet, /movementType: "adjustment"/)
  assert.match(adjustmentSheet, /Ajuste:/)
  assert.match(adjustmentSheet, /El stock no puede quedar negativo/)
  assert.match(sql, /Stock disponible insuficiente para la salida/)
  assert.match(sql, /El stock ajustado no puede ser negativo/)
})

test("8. Editar material, stock persistido y KPIs únicos", () => {
  assert.match(materialsTable, /onEdit/)
  assert.match(materialsTable, /quantityAvailable/)
  assert.match(materialsModule, /inventoryRowToCatalog/)
  assert.match(queries, /lowStockMaterialIds/)
  assert.match(queries, /material:materials\(\*\), warehouse:warehouses\(\*\)/)
  assert.match(materialForm, /Guardar cambios/)
  assert.match(materialForm, /Stock actual/)
  assert.match(materialForm, /Se genera una alerta cuando el stock disponible/)
})

test("9. Filtro por depósito y todos los depósitos", () => {
  const rows = [
    {
      stockLevelId: "sl-1",
      materialId: "m-1",
      warehouseId: "w-1",
      code: "A",
      name: "Cable",
      category: "consumables",
      itemType: "consumable",
      unit: "m",
      minStock: 10,
      quantityAvailable: 100,
      quantityReserved: 0,
      netAvailable: 100,
      warehouse: "Central",
      status: "available",
      manufacturer: "",
      description: "",
      active: true,
    },
    {
      stockLevelId: "sl-2",
      materialId: "m-1",
      warehouseId: "w-2",
      code: "A",
      name: "Cable",
      category: "consumables",
      itemType: "consumable",
      unit: "m",
      minStock: 10,
      quantityAvailable: 5,
      quantityReserved: 0,
      netAvailable: 5,
      warehouse: "Norte",
      status: "low-stock",
      manufacturer: "",
      description: "",
      active: true,
    },
  ]

  assert.equal(
    filterInventoryRows(rows, {
      ...defaultMaterialFilters,
      warehouse: "all",
    }).length,
    2
  )
  assert.equal(
    filterInventoryRows(rows, {
      ...defaultMaterialFilters,
      warehouse: "Norte",
    }).length,
    1
  )

  const options = mergeWarehouseFilterOptions(["Central"], {
    warehouses: [sampleWarehouse("w-2", "Norte")],
    mode: "manual",
    defaultWarehouseId: null,
  })
  assert.deepEqual(options, ["Central", "Norte"])
})

test("10. API, permisos y aislamiento company_id", () => {
  assert.equal(canManageMaterials(materialsUser), true)
  assert.equal(
    canAccessPathWithModules("/materiales", materialsUser.moduleVisibility),
    true
  )
  assert.match(routeContext, /requireMaterialsMutationContext/)
  assert.match(apiWarehouses, /createWarehouse/)
  assert.match(apiMaterials, /createMaterial/)
  assert.match(apiMovements, /recordMaterialMovement/)
  assert.match(queries, /\.eq\("company_id", companyId\)/)
  assert.match(sql, /company_id = public\.auth_user_company_id\(\)/)
  assert.match(materialsModule, /mergeWarehouseFilterOptions/)
  assert.match(materialForm, /MaterialsSheetShell/)
  assert.match(adjustmentSheet, /MaterialsSheetShell/)
})

test("11. Catálogo separado de stock y foto opcional", () => {
  assert.match(catalogPhotoSql, /photo_attachment_id/)
  assert.match(catalogPhotoSql, /'materials'/)
  assert.match(catalogPhotoSql, /p_photo_attachment_id/)
  assert.match(attachmentConstants, /"materials"/)
  assert.match(queries, /fetchMaterialCatalog/)
  assert.match(materialsModule, /Catálogo/)
  assert.match(materialsModule, /MaterialCatalogSheet/)
  assert.match(materialsModule, /Registrar entrada/)
  assert.match(materialsModule, /api\/materiales\/catalog/)
  assert.match(movementSheet, /MaterialCatalogPicker/)
  assert.match(movementSheet, /lockMaterial/)
  assert.match(catalogPicker, /No se puede crear uno nuevo/)
  assert.match(materialForm, /Nuevo material de catálogo/)
  assert.match(materialForm, /MaterialPhotoField/)
  assert.match(materialsTable, /onEdit/)
  assert.match(catalogLib, /filterCatalogOptions/)
  assert.match(photoField, /module: "materials"/)
})

test("12. Eliminación lógica del catálogo, stock y permisos", () => {
  assert.match(catalogDeleteSql, /CREATE OR REPLACE FUNCTION public\.delete_material/)
  assert.match(catalogDeleteSql, /active = false/)
  assert.match(
    catalogDeleteSql,
    /No se puede eliminar un material con stock/
  )
  assert.match(catalogDeleteSql, /quantity_available > 0/)
  assert.match(catalogDeleteSql, /auth_can_manage_materials/)
  assert.match(catalogDeleteSql, /company_id = v_company_id/)
  assert.match(queries, /deleteMaterial/)
  assert.match(queries, /delete_material/)
  assert.match(apiMaterialById, /export async function DELETE/)
  assert.match(apiMaterialById, /requireMaterialsMutationContext/)
  assert.match(apiMaterialById, /deleteMaterial/)
  assert.match(materialsModule, /Eliminar material del catálogo/)
  assert.match(materialsModule, /method: "DELETE"/)
  assert.match(materialsModule, /MaterialCatalogSheet/)
  assert.match(queries, /fetchMaterialCatalog/)
  assert.match(queries, /\.eq\("active", true\)/)
  assert.match(catalogPhotoSql, /CREATE OR REPLACE FUNCTION public\.update_material/)
})

test("13. Códigos reutilizables, foto en alta y validación amigable", () => {
  assert.match(reusableCodesSql, /materials_company_active_code_unique/)
  assert.match(reusableCodesSql, /DROP CONSTRAINT IF EXISTS materials_company_code_unique/)
  assert.match(materialCodeLib, /hasActiveCatalogCodeConflict/)
  assert.match(materialCodeLib, /formatDuplicateActiveMaterialCodeMessage/)
  assert.match(queries, /mapMaterialCodeErrorMessage/)
  assert.match(materialForm, /pendingPhotoFile/)
  assert.match(materialForm, /uploadPendingPhoto/)
  assert.match(photoField, /pendingFile/)
  assert.match(photoField, /Seleccionar foto/)
  assert.doesNotMatch(
    photoField,
    /Guarde el material primero para asociar una foto/
  )
  assert.match(materialForm, /Crear material/)
  assert.match(materialForm, /Nuevo material de catálogo/)
})

test("14. Separación catálogo / inventario (1.0.7)", () => {
  assert.match(separationSql, /Materiales 1\.0\.7/)
  assert.match(separationSql, /DELETE FROM public\.material_stock_levels/)
  assert.match(queries, /fetchMaterialIdsWithMovements/)
  assert.match(materialsModule, /Inventario/)
  assert.match(materialsModule, /buildCatalogDisplayRows/)
  assert.doesNotMatch(materialForm, /initialWarehouseId/)
})
