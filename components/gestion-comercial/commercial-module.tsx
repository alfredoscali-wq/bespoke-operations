"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Plus, X } from "lucide-react"

import { CommercialOpportunityDrawer } from "@/components/gestion-comercial/commercial-opportunity-drawer"
import {
  CommercialProvider,
  useCommercialOpportunities,
  useCommercialPeople,
} from "@/components/gestion-comercial/commercial-provider"
import { EmployeesProvider } from "@/components/rrhh/employees-provider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
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
import { cn } from "@/lib/utils"
import type { CommercialOpportunityListItem } from "@/lib/types/commercial"

function CommercialModuleContent() {
  const { data: opportunities, isLoading } = useCommercialOpportunities()
  const { data: people } = useCommercialPeople()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<
    string | null
  >(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const selectedRowRef = useRef<HTMLTableRowElement | null>(null)

  useEffect(() => {
    if (!selectedOpportunityId || !selectedRowRef.current) {
      return
    }

    selectedRowRef.current.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    })
  }, [selectedOpportunityId, opportunities])

  useEffect(() => {
    if (!toastMessage) return
    const timer = window.setTimeout(() => setToastMessage(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toastMessage])

  function handleCreated(opportunity: CommercialOpportunityListItem) {
    setSelectedOpportunityId(opportunity.id)
    setToastMessage("Oportunidad creada correctamente.")
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
        <Button
          type="button"
          className="gap-2"
          onClick={() => setDrawerOpen(true)}
        >
          <Plus className="size-4" />
          Nueva Oportunidad
        </Button>
      </div>

      {toastMessage ? (
        <Alert
          className="border-emerald-200 bg-emerald-50 text-emerald-950"
          role="status"
        >
          <CheckCircle2 className="text-emerald-600" />
          <AlertTitle>Listo</AlertTitle>
          <AlertDescription>{toastMessage}</AlertDescription>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute top-2 right-2"
            onClick={() => setToastMessage(null)}
            aria-label="Cerrar mensaje"
          >
            <X className="size-4" />
          </Button>
        </Alert>
      ) : null}

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
                opportunities.map((opportunity) => {
                  const selected = opportunity.id === selectedOpportunityId
                  return (
                    <TableRow
                      key={opportunity.id}
                      ref={selected ? selectedRowRef : undefined}
                      data-opportunity-id={opportunity.id}
                      data-state={selected ? "selected" : undefined}
                      className={cn(
                        "cursor-pointer",
                        selected && "bg-muted/60"
                      )}
                      onClick={() => setSelectedOpportunityId(opportunity.id)}
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
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <CommercialOpportunityDrawer
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
