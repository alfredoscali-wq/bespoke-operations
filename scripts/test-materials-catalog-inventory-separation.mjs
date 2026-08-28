import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"

import {
  buildCatalogDisplayRows,
  formatCatalogTotalStock,
  materialHasInventoryHistory,
} from "../lib/materials/catalog-display.ts"
import {
  buildInventoryRowsFromStockLevels,
  createSyntheticInventoryRow,
} from "../lib/supabase/materials.mapper.ts"

const root = resolve(import.meta.dirname, "..")

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8")
}

const separationSql = read(
  "supabase/migrations/20261149000106_materials_1_0_7_catalog_inventory.sql"
)
const materialsModule = read("components/materiales/materials-module.tsx")
const materialForm = read("components/materiales/material-form-sheet.tsx")
const queries = read("lib/supabase/materials.queries.ts")
const mapper = read("lib/supabase/materials.mapper.ts")

const sampleCatalogItem = (id, code) => ({
  id,
  companyId: "c-1",
  code,
  name: `Material ${code}`,
  category: "consumables",
  itemType: "consumable",
  unit: "m",
  minStock: 10,
  manufacturer: "",
  description: "",
  active: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  photoAttachmentId: null,
})

const sampleInventoryRow = (materialId, code, qty, warehouseId = "w-1") => ({
  stockLevelId: `sl-${materialId}-${warehouseId}`,
  materialId,
  warehouseId,
  code,
  name: `Material ${code}`,
  category: "consumables",
  itemType: "consumable",
  unit: "m",
  minStock: 10,
  quantityAvailable: qty,
  quantityReserved: 0,
  netAvailable: qty,
  warehouse: warehouseId === "w-1" ? "Central" : "Norte",
  status: qty === 0 ? "out-of-stock" : "available",
  manufacturer: "",
  description: "",
  active: true,
  isSynthetic: false,
})

test("1. Migración: catálogo sin stock level y limpieza huérfanos", () => {
  assert.match(separationSql, /DELETE FROM public\.material_stock_levels/)
  assert.match(separationSql, /quantity_available = 0/)
  assert.match(separationSql, /NOT EXISTS/)
  assert.match(separationSql, /material_movements/)
  assert.match(separationSql, /CREATE OR REPLACE FUNCTION public\.create_material/)
  assert.match(separationSql, /INSERT INTO public\.materials/)
  assert.doesNotMatch(separationSql, /INSERT INTO public\.material_stock_levels/)
})

test("2. Inventario solo desde stock levels reales", () => {
  const material = {
    id: "m-1",
    company_id: "c-1",
    code: "FO-12",
    name: "Fibra",
    category: "consumables",
    type: "consumable",
    unit: "m",
    min_stock: "10",
    manufacturer: "",
    description: "",
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    photo_attachment_id: null,
  }
  const warehouse = {
    id: "w-1",
    company_id: "c-1",
    name: "Central",
    active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  }
  const stockLevels = [
    {
      id: "sl-1",
      company_id: "c-1",
      material_id: "m-1",
      warehouse_id: "w-1",
      quantity_available: "2500",
      quantity_reserved: "0",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      material,
      warehouse,
    },
  ]

  const rows = buildInventoryRowsFromStockLevels(stockLevels)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].quantityAvailable, 2500)

  const orphanSynthetic = createSyntheticInventoryRow(material, warehouse, 0, 0)
  const withoutStock = buildInventoryRowsFromStockLevels([])
  assert.equal(withoutStock.length, 0)
  assert.equal(orphanSynthetic.isSynthetic, true)
})

test("3. Catálogo muestra todos los activos con stock diferenciado", () => {
  const catalog = [
    sampleCatalogItem("m-1", "FO-12"),
    sampleCatalogItem("m-2", "AB-01"),
  ]
  const inventory = [sampleInventoryRow("m-1", "FO-12", 2500)]
  const movementIds = new Set()

  const rows = buildCatalogDisplayRows(catalog, inventory, movementIds)
  assert.equal(rows.length, 2)

  const withStock = rows.find((row) => row.id === "m-1")
  const withoutStock = rows.find((row) => row.id === "m-2")

  assert.equal(withStock?.totalStock, 2500)
  assert.equal(withStock?.inventoryStatus, "available")
  assert.equal(withoutStock?.totalStock, null)
  assert.equal(withoutStock?.inventoryStatus, "no-inventory")
  assert.equal(
    formatCatalogTotalStock(null, "m"),
    "Sin stock registrado"
  )
})

test("4. Material agotado sigue en inventario", () => {
  const inventory = [sampleInventoryRow("m-1", "FO-12", 0)]
  const movementIds = new Set(["m-1"])

  assert.equal(
    materialHasInventoryHistory("m-1", inventory, movementIds),
    true
  )

  const catalogRows = buildCatalogDisplayRows(
    [sampleCatalogItem("m-1", "FO-12")],
    inventory,
    movementIds
  )
  assert.equal(catalogRows[0].totalStock, 0)
  assert.equal(catalogRows[0].inventoryStatus, "out-of-stock")
  assert.equal(inventory[0].status, "out-of-stock")
})

test("5. UI separa Catálogo e Inventario", () => {
  assert.match(materialsModule, /MaterialCatalogSheet/)
  assert.match(materialsModule, /Catálogo/)
  assert.match(materialsModule, /Inventario/)
  assert.match(materialsModule, /buildCatalogDisplayRows/)
  assert.doesNotMatch(materialsModule, /Nuevo catálogo/)
  assert.match(materialForm, /Nuevo material de catálogo/)
  assert.doesNotMatch(materialForm, /initialWarehouseId/)
  assert.match(queries, /buildInventoryRowsFromStockLevels/)
  assert.match(mapper, /buildInventoryRowsFromStockLevels/)
})
