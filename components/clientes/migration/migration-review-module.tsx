"use client"

import { useMemo, useState } from "react"

import { MigrationReviewExportMenu } from "@/components/clientes/migration/migration-review-export-menu"
import { MigrationReviewFiltersBar } from "@/components/clientes/migration/migration-review-filters"
import { MigrationReviewList } from "@/components/clientes/migration/migration-review-list"
import {
  MigrationReviewProvider,
  useMigrationReview,
} from "@/components/clientes/migration/migration-review-provider"
import { MigrationReviewSummary } from "@/components/clientes/migration/migration-review-summary"
import {
  defaultMigrationReviewFilters,
  type MigrationReviewFilters,
} from "@/lib/customers/commercial-migration/review-types"
import { filterMigrationReviewRecords } from "@/lib/customers/commercial-migration/review-utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"

export function MigrationReviewModule() {
  return (
    <MigrationReviewProvider>
      <MigrationReviewModuleContent />
    </MigrationReviewProvider>
  )
}

function MigrationReviewModuleContent() {
  const { isReady, error, generatedAt, sourceDump, reload, records } =
    useMigrationReview()
  const [filters, setFilters] = useState<MigrationReviewFilters>(
    defaultMigrationReviewFilters
  )
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  const displayedRecords = useMemo(
    () => filterMigrationReviewRecords(records, filters),
    [records, filters]
  )

  function handleKpiFilterChange(
    kpiFilter: MigrationReviewFilters["kpiFilter"]
  ) {
    setFilters((current) => ({ ...current, kpiFilter }))
  }

  async function handleImport() {
    setIsImporting(true)
    setFeedback(null)
    try {
      const response = await fetch("/api/clientes/migracion/import", {
        method: "POST",
      })
      const data = (await response.json()) as {
        ok?: boolean
        imported?: number
        skipped?: number
        errors?: { legacyId: number; message: string }[]
        error?: string
      }

      if (!response.ok) {
        throw new Error(data.error ?? "No fue posible importar clientes")
      }

      setFeedback(
        `Importación completada: ${data.imported ?? 0} clientes importados, ${data.skipped ?? 0} omitidos.`
      )
    } catch (importError) {
      setFeedback(
        importError instanceof Error
          ? importError.message
          : "No fue posible importar clientes"
      )
    } finally {
      setIsImporting(false)
    }
  }

  if (!isReady) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
        Cargando dataset de migración...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">
          No fue posible cargar el centro de revisión
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <Button className="mt-4" variant="outline" onClick={() => void reload()}>
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="max-w-3xl text-sm text-muted-foreground">
            Centro de migración RC1.1 — clientes operativos con al menos una
            conexión asociada. El estado de validación es informativo y no
            bloquea la operación en Bespoke.
          </p>
          {generatedAt ? (
            <p className="text-xs text-muted-foreground">
              Dataset generado: {new Date(generatedAt).toLocaleString("es-AR")}
              {sourceDump ? ` · ${sourceDump.split(/[/\\]/).pop()}` : null}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => void handleImport()}
            disabled={isImporting}
          >
            {isImporting ? "Importando..." : "Importar a Bespoke"}
          </Button>
          <MigrationReviewExportMenu />
        </div>
      </div>

      <EntityActionFeedback message={feedback} />

      <MigrationReviewSummary
        kpiFilter={filters.kpiFilter}
        onKpiFilterChange={handleKpiFilterChange}
      />

      <Card className="shadow-sm">
        <CardHeader className="border-b">
          <CardTitle className="text-base">Revisión de clientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <MigrationReviewFiltersBar
            filters={filters}
            onChange={setFilters}
            resultCount={displayedRecords.length}
          />
          <MigrationReviewList records={displayedRecords} />
        </CardContent>
      </Card>
    </div>
  )
}
