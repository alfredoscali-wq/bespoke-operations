"use client"

import Link from "next/link"
import { Pencil } from "lucide-react"

import { CONTRACTOR_STATUS_LABELS } from "@/lib/contractors/constants"
import { getContractorDisplayName } from "@/lib/contractors/utils"
import type { ContractorListItem } from "@/lib/types/contractors"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ContractorsTableProps = {
  contractors: ContractorListItem[]
  onEdit: (contractor: ContractorListItem) => void
}

export function ContractorsTable({
  contractors,
  onEdit,
}: ContractorsTableProps) {
  if (contractors.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No hay contratistas registrados.
      </p>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Contratista</TableHead>
          <TableHead>CUIT</TableHead>
          <TableHead>Responsable</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Cuadrillas</TableHead>
          <TableHead className="text-right">Usuarios</TableHead>
          <TableHead className="w-[100px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {contractors.map((contractor) => (
          <TableRow key={contractor.id}>
            <TableCell>
              <Link
                href={`/contratistas/${contractor.id}`}
                className="font-medium text-foreground hover:underline"
              >
                {getContractorDisplayName(contractor)}
              </Link>
              {contractor.tradeName.trim() &&
              contractor.tradeName !== contractor.legalName ? (
                <p className="text-xs text-muted-foreground">
                  {contractor.legalName}
                </p>
              ) : null}
            </TableCell>
            <TableCell className="font-mono text-sm">{contractor.taxId}</TableCell>
            <TableCell>{contractor.responsibleName || "—"}</TableCell>
            <TableCell>
              <Badge
                variant={
                  contractor.status === "activo" ? "default" : "secondary"
                }
              >
                {CONTRACTOR_STATUS_LABELS[contractor.status]}
              </Badge>
            </TableCell>
            <TableCell className="text-right">{contractor.crewCount}</TableCell>
            <TableCell className="text-right">{contractor.userCount}</TableCell>
            <TableCell>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => onEdit(contractor)}
                aria-label={`Editar ${getContractorDisplayName(contractor)}`}
              >
                <Pencil className="size-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
