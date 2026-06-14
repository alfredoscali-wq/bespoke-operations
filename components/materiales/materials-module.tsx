"use client"

import { useMemo, useState } from "react"

import { MaterialsFiltersBar } from "@/components/materiales/materials-filters"
import { MaterialsSummaryCards } from "@/components/materiales/materials-summary-cards"
import { MaterialsTable } from "@/components/materiales/materials-table"
import {
  defaultMaterialFilters,
  filterMaterials,
  getWarehouseOptions,
  mockMaterials,
} from "@/lib/data/materials"
import type { MaterialFilters } from "@/lib/types/materials"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function MaterialsModule() {
  const [filters, setFilters] = useState<MaterialFilters>(
    defaultMaterialFilters
  )

  const warehouses = useMemo(() => getWarehouseOptions(), [])

  const filteredMaterials = useMemo(
    () => filterMaterials(mockMaterials, filters),
    [filters]
  )

  return (
    <div className="space-y-6">
      <MaterialsSummaryCards />

      <Card className="shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="text-base">Inventario de materiales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <MaterialsFiltersBar
            filters={filters}
            onChange={setFilters}
            resultCount={filteredMaterials.length}
            warehouses={warehouses}
          />
          <MaterialsTable materials={filteredMaterials} />
        </CardContent>
      </Card>
    </div>
  )
}
