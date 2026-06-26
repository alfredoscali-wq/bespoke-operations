"use client"

import { useState } from "react"
import {
  Ban,
  CheckCircle2,
  Clock3,
  Eye,
  Loader2,
  MoreHorizontal,
} from "lucide-react"

import { MigrationReviewDetailSheet } from "@/components/clientes/migration/migration-review-detail-sheet"
import { useMigrationReview } from "@/components/clientes/migration/migration-review-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCustomerTechnologyLabel } from "@/lib/customers/format"
import {
  formatValidationStatusLabel,
  validationStatusBadgeClassName,
  validationStatusDotClassName,
} from "@/lib/customers/customer-validation"
import type { EnrichedMigrationCustomer } from "@/lib/customers/commercial-migration/review-types"
import type { MigrationReviewAction } from "@/lib/customers/commercial-migration/review-types"
import {
  getMigrationReviewPrimaryReason,
} from "@/lib/customers/commercial-migration/review-utils"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 50

type MigrationReviewListProps = {
  records: EnrichedMigrationCustomer[]
}

function ValidationBadge({
  status,
}: {
  status: EnrichedMigrationCustomer["effectiveValidationStatus"]
}) {
  if (!status) {
    return (
      <span className="inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
        Descartado
      </span>
    )
  }

  return (
    <span className={validationStatusBadgeClassName(status)}>
      <span className={validationStatusDotClassName(status)} />
      {formatValidationStatusLabel(status)}
    </span>
  )
}

export function MigrationReviewList({ records }: MigrationReviewListProps) {
  const { applyReviewAction } = useMigrationReview()
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<EnrichedMigrationCustomer | null>(
    null
  )
  const [pendingId, setPendingId] = useState<number | null>(null)

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const pageRecords = records.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE
  )

  async function handleAction(
    record: EnrichedMigrationCustomer,
    action: MigrationReviewAction
  ) {
    setPendingId(record.legacyId)
    try {
      await applyReviewAction(record.legacyId, action)
    } finally {
      setPendingId(null)
    }
  }

  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          No se encontraron registros
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajustá los filtros o la búsqueda para ver resultados.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Validación</TableHead>
              <TableHead>N° Cliente</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>DNI</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Localidad</TableHead>
              <TableHead>Tecnología</TableHead>
              <TableHead>Legacy</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead className="w-[72px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRecords.map((record) => {
              const isPending = pendingId === record.legacyId

              return (
                <TableRow key={record.legacyId}>
                  <TableCell>
                    <ValidationBadge status={record.effectiveValidationStatus} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {record.externalCustomerCode || "—"}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate font-medium">
                    {record.name || "—"}
                  </TableCell>
                  <TableCell>{record.dni || "—"}</TableCell>
                  <TableCell className="max-w-[180px] truncate">
                    {record.address || "—"}
                  </TableCell>
                  <TableCell>{record.locality || "—"}</TableCell>
                  <TableCell>
                    {formatCustomerTechnologyLabel(record.technology) ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {record.legacyClientState || "—"}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-muted-foreground">
                    {getMigrationReviewPrimaryReason(record)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={isPending}
                        >
                          {isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="size-4" />
                          )}
                          <span className="sr-only">Acciones</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelected(record)}>
                          <Eye className="size-4" />
                          Ver detalle
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => void handleAction(record, "aprobado")}
                        >
                          <CheckCircle2 className="size-4" />
                          Marcar activo
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            void handleAction(record, "revisar_posterior")
                          }
                        >
                          <Clock3 className="size-4" />
                          Marcar revisión posterior
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => void handleAction(record, "excluido")}
                        >
                          <Ban className="size-4" />
                          Excluir de la migración
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 text-sm text-muted-foreground">
          <p>
            Página {currentPage + 1} de {totalPages} · {records.length} registros
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages - 1}
              onClick={() =>
                setPage((value) => Math.min(totalPages - 1, value + 1))
              }
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      <MigrationReviewDetailSheet
        record={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      />
    </>
  )
}
