"use client"

import { useState } from "react"
import { ArrowDownCircle, ArrowUpCircle, LayoutList, Wallet } from "lucide-react"

import { EmployeesProvider } from "@/components/rrhh/employees-provider"
import { TreasuryCategorySummaryDialog } from "@/components/tesoreria/treasury-category-summary-dialog"
import { TreasuryMovementFormDialog } from "@/components/tesoreria/treasury-movement-form-dialog"
import { TreasuryMovementsHistory } from "@/components/tesoreria/treasury-movements-history"
import { TreasuryPendingRenditionsList } from "@/components/tesoreria/treasury-pending-renditions-list"
import { TreasuryProvider, useTreasury } from "@/components/tesoreria/treasury-provider"
import { TreasurySummaryCards } from "@/components/tesoreria/treasury-summary-cards"
import { TREASURY_MOVEMENT_TYPES } from "@/lib/tesoreria/categories"
import type { TreasuryMovementType } from "@/lib/tesoreria/categories"
import { Button } from "@/components/ui/button"

function TreasuryModuleContent() {
  const { canWrite, historyFilter } = useTreasury()
  const [formType, setFormType] = useState<TreasuryMovementType | null>(null)
  const [categorySummaryOpen, setCategorySummaryOpen] = useState(false)
  const pendingFilterActive = historyFilter.type === "pendingRendition"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tesorería</h1>
        <p className="text-sm text-muted-foreground">
          Registro operativo de ingresos, egresos, retiros y rendiciones de OT.
          No es un módulo contable.
        </p>
      </div>

      <TreasurySummaryCards />

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          className="gap-2"
          disabled={!canWrite}
          onClick={() => setFormType(TREASURY_MOVEMENT_TYPES.INCOME)}
        >
          <ArrowUpCircle className="size-4" />
          Registrar Ingreso
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="gap-2"
          disabled={!canWrite}
          onClick={() => setFormType(TREASURY_MOVEMENT_TYPES.EXPENSE)}
        >
          <ArrowDownCircle className="size-4" />
          Registrar Egreso
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2 border-orange-300 text-orange-900 hover:bg-orange-50 hover:text-orange-950"
          disabled={!canWrite}
          onClick={() => setFormType(TREASURY_MOVEMENT_TYPES.WITHDRAWAL)}
        >
          <Wallet className="size-4" />
          Registrar Retiro
        </Button>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => setCategorySummaryOpen(true)}
        >
          <LayoutList className="size-4" />
          Resumen por Categoría
        </Button>
        {!canWrite ? (
          <p className="self-center text-xs text-muted-foreground">
            Solo lectura. La edición está disponible para Administración.
          </p>
        ) : null}
      </div>

      <TreasuryPendingRenditionsList />
      {!pendingFilterActive ? <TreasuryMovementsHistory /> : null}

      {formType ? (
        <TreasuryMovementFormDialog
          key={formType}
          open
          movementType={formType}
          onOpenChange={(open) => {
            if (!open) setFormType(null)
          }}
        />
      ) : null}

      <TreasuryCategorySummaryDialog
        open={categorySummaryOpen}
        onOpenChange={setCategorySummaryOpen}
      />
    </div>
  )
}

export function TreasuryModule() {
  return (
    <EmployeesProvider>
      <TreasuryProvider>
        <TreasuryModuleContent />
      </TreasuryProvider>
    </EmployeesProvider>
  )
}
