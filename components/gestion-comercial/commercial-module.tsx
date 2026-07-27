"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { MoreHorizontal, Plus } from "lucide-react"

import { CommercialNewOpportunityDrawer } from "@/components/gestion-comercial/commercial-new-opportunity-drawer"
import {
  CommercialProvider,
  useCommercialOpportunities,
  useCommercialPeople,
} from "@/components/gestion-comercial/commercial-provider"
import { EmployeesProvider } from "@/components/rrhh/employees-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TableRowsSkeleton } from "@/components/ui/kpi-grid-skeleton"
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
import type { CommercialOpportunityListItem } from "@/lib/types/commercial"

function CommercialModuleContent() {
  const router = useRouter()
  const { data: opportunities, isLoading } = useCommercialOpportunities()
  const { data: people } = useCommercialPeople()
  const [drawerOpen, setDrawerOpen] = useState(false)

  function openDossier(opportunityId: string) {
    router.push(`/gestion-comercial/${opportunityId}`)
  }

  function handleCreated(opportunity: CommercialOpportunityListItem) {
    router.push(`/gestion-comercial/${opportunity.id}`)
  }

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
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/gestion-comercial/mapa")}
          >
            Territorio
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={() => setDrawerOpen(true)}
          >
            <Plus className="size-4" />
            Nueva Oportunidad
          </Button>
        </div>
      </div>

      <div className="rounded-lg border">
        {isLoading ? (
          <div className="p-4">
            <TableRowsSkeleton columns={6} rows={4} />
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
                <TableHead className="w-12 text-right">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {opportunities.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    Todavía no existen oportunidades comerciales.
                  </TableCell>
                </TableRow>
              ) : (
                opportunities.map((opportunity) => (
                  <TableRow
                    key={opportunity.id}
                    data-opportunity-id={opportunity.id}
                    className="cursor-pointer"
                    onClick={() => openDossier(opportunity.id)}
                  >
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
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Acciones"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <DropdownMenuItem
                            onSelect={() => openDossier(opportunity.id)}
                          >
                            Ver
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <CommercialNewOpportunityDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        people={people}
        onCreated={handleCreated}
      />
    </div>
  )
}

export function CommercialModule() {
  return (
    <EmployeesProvider>
      <CommercialProvider>
        <CommercialModuleContent />
      </CommercialProvider>
    </EmployeesProvider>
  )
}
