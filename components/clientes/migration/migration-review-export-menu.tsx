"use client"

import { FileSpreadsheet } from "lucide-react"

import { useMigrationReview } from "@/components/clientes/migration/migration-review-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { exportMigrationRecordsToXlsx } from "@/lib/customers/commercial-migration/review-export"

export function MigrationReviewExportMenu() {
  const { records } = useMigrationReview()

  const activos = records.filter(
    (record) => record.effectiveValidationStatus === "active"
  )
  const revisar = records.filter(
    (record) => record.effectiveValidationStatus === "review"
  )
  const descartados = records.filter(
    (record) => record.effectiveBucket === "descartado"
  )

  const stamp = new Date().toISOString().slice(0, 10)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FileSpreadsheet className="size-4" />
          Exportar Excel
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() =>
            exportMigrationRecordsToXlsx(
              activos,
              `migracion-clientes-activos-${stamp}.xlsx`
            )
          }
        >
          Clientes activos ({activos.length})
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            exportMigrationRecordsToXlsx(
              revisar,
              `migracion-clientes-revisar-${stamp}.xlsx`
            )
          }
        >
          Clientes a revisar ({revisar.length})
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            exportMigrationRecordsToXlsx(
              descartados,
              `migracion-clientes-descartados-${stamp}.xlsx`
            )
          }
        >
          Clientes descartados ({descartados.length})
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
