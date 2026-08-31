"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

import { TvPlanFormDialog } from "@/components/subscriptions/tv-plan-form-dialog"
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
import { formatTvMoney, type TvPlanKpi } from "@/lib/subscriptions/tv-plans"
import type { TvPlanWriteDraft } from "@/lib/subscriptions/tv-catalog"
import type { TvCatalogPlan } from "@/lib/types/subscriptions"

export function TvPlansCatalogSection({
  plans,
  kpis,
  canWrite,
  onCreate,
  onUpdate,
  onToggleActive,
}: {
  plans: TvCatalogPlan[]
  kpis: readonly TvPlanKpi[]
  canWrite: boolean
  onCreate: (draft: TvPlanWriteDraft) => Promise<string | null>
  onUpdate: (id: string, draft: TvPlanWriteDraft) => Promise<string | null>
  onToggleActive: (plan: TvCatalogPlan) => Promise<string | null>
}) {
  const kpiById = new Map(kpis.map((plan) => [plan.catalogId, plan]))
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TvCatalogPlan | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  function openCreate() {
    setEditing(null)
    setActionError(null)
    setOpen(true)
  }

  function openEdit(plan: TvCatalogPlan) {
    setEditing(plan)
    setActionError(null)
    setOpen(true)
  }

  async function handleSave(draft: TvPlanWriteDraft) {
    if (editing) return onUpdate(editing.id, draft)
    return onCreate(draft)
  }

  return (
    <section className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Planes de TV</h2>
          <p className="text-xs text-muted-foreground">
            Catálogo de planes TV de la empresa. Servicios los usa como
            componente interno; el abono comercial sigue siendo uno solo.
          </p>
        </div>
        {canWrite ? (
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            Nuevo plan TV
          </Button>
        ) : null}
      </div>

      {actionError ? (
        <p className="text-sm text-destructive">{actionError}</p>
      ) : null}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Nombre</TableHead>
              <TableHead>Precio mensual</TableHead>
              <TableHead>Clientes</TableHead>
              <TableHead>Ingreso mensual TV</TableHead>
              <TableHead>Estado</TableHead>
              {canWrite ? (
                <TableHead className="text-right">Acciones</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canWrite ? 6 : 5}
                  className="text-muted-foreground"
                >
                  Todavía no hay planes TV para esta empresa.
                </TableCell>
              </TableRow>
            ) : (
              plans.map((plan) => {
                const kpi = kpiById.get(plan.id)
                const clients = kpi?.activeCount ?? 0
                const revenue = kpi?.monthlyRevenue ?? 0
                return (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatTvMoney(plan.monthlyPrice)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {clients} {clients === 1 ? "cliente" : "clientes"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatTvMoney(revenue)} / mes
                  </TableCell>
                  <TableCell>
                    <Badge variant={plan.isActive ? "secondary" : "outline"}>
                      {plan.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  {canWrite ? (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openEdit(plan)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            void onToggleActive(plan).then((message) =>
                              setActionError(message)
                            )
                          }}
                        >
                          {plan.isActive ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <TvPlanFormDialog
        open={open}
        plan={editing}
        onOpenChange={setOpen}
        onSave={handleSave}
      />
    </section>
  )
}
