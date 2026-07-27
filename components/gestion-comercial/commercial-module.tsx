"use client"

import { Plus } from "lucide-react"

import {
  CommercialProvider,
  useCommercialOpportunities,
} from "@/components/gestion-comercial/commercial-provider"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  COMMERCIAL_PRIORITY_LABELS,
  COMMERCIAL_STATUS_LABELS,
} from "@/lib/commercial/catalogs"
import { TableRowsSkeleton } from "@/components/ui/kpi-grid-skeleton"

function CommercialModuleContent() {
  const { data: opportunities, isLoading } = useCommercialOpportunities()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Gestión Comercial
          </h1>
          <p className="text-sm text-muted-foreground">
            Administra prospectos y oportunidades comerciales.
          </p>
        </div>
        <Button type="button" className="gap-2">
          <Plus className="size-4" />
          Nueva Oportunidad
        </Button>
      </div>

      <div className="rounded-lg border">
        {isLoading ? (
          <div className="p-4">
            <TableRowsSkeleton columns={5} rows={4} />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Prospecto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Prioridad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    Todavía no existen oportunidades comerciales.
                  </TableCell>
                </TableRow>
              ) : (
                opportunities.map((opportunity) => (
                  <TableRow key={opportunity.id}>
                    <TableCell className="font-medium tabular-nums">
                      {opportunity.code}
                    </TableCell>
                    <TableCell>{opportunity.title}</TableCell>
                    <TableCell>{opportunity.personDisplayName}</TableCell>
                    <TableCell>
                      {COMMERCIAL_STATUS_LABELS[opportunity.status]}
                    </TableCell>
                    <TableCell>
                      {COMMERCIAL_PRIORITY_LABELS[opportunity.priority]}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

export function CommercialModule() {
  return (
    <CommercialProvider>
      <CommercialModuleContent />
    </CommercialProvider>
  )
}
