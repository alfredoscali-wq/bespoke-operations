"use client"

import Link from "next/link"

import {
  EvidenceCategoryBadge,
  EvidenceStatusBadge,
  EvidenceTypeBadge,
  EvidenceVoidedBadge,
} from "@/components/evidencias/evidence-badges"
import { formatEvidenceDateTime } from "@/lib/evidence/constants"
import type { EvidenceRecord } from "@/lib/types/evidence"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type EvidenceTableProps = {
  evidence: EvidenceRecord[]
}

export function EvidenceTable({ evidence }: EvidenceTableProps) {
  if (evidence.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium text-foreground">
          No se encontraron evidencias
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajusta los filtros para ver más resultados.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border bg-card shadow-sm lg:block">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo evidencia</TableHead>
                <TableHead>Archivo</TableHead>
                <TableHead>Formato</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>OT</TableHead>
                <TableHead>Cuadrilla</TableHead>
                <TableHead>Operario</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evidence.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatEvidenceDateTime(item.uploadedAt)}
                  </TableCell>
                  <TableCell>
                    <EvidenceCategoryBadge evidenceType={item.evidenceType} />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/evidencias/${item.id}`}
                      className="font-medium hover:text-primary"
                    >
                      {item.fileName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <EvidenceTypeBadge type={item.type} />
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{item.projectCode}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs">{item.taskCode}</span>
                  </TableCell>
                  <TableCell className="max-w-[140px] truncate text-muted-foreground">
                    {item.crew}
                  </TableCell>
                  <TableCell className="max-w-[120px] truncate text-muted-foreground">
                    {item.worker}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <EvidenceStatusBadge status={item.status} />
                      {item.deletedAt ? <EvidenceVoidedBadge /> : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {evidence.map((item) => (
          <Link key={item.id} href={`/evidencias/${item.id}`}>
            <Card className="shadow-sm transition-colors hover:bg-muted/30">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-sm leading-snug">
                      {item.fileName}
                    </CardTitle>
                    <CardDescription>
                      {formatEvidenceDateTime(item.uploadedAt)}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <EvidenceStatusBadge status={item.status} />
                    {item.deletedAt ? <EvidenceVoidedBadge /> : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <EvidenceCategoryBadge evidenceType={item.evidenceType} />
                <EvidenceTypeBadge type={item.type} />
                <span className="font-mono text-[11px] text-muted-foreground">
                  {item.projectCode} · {item.taskCode}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  )
}
