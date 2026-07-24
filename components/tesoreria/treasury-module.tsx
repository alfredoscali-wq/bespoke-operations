"use client"

import { useState } from "react"
import { ArrowDownCircle, ArrowUpCircle } from "lucide-react"

import { EmployeesProvider } from "@/components/rrhh/employees-provider"
import { TreasuryMovementFormDialog } from "@/components/tesoreria/treasury-movement-form-dialog"
import { TreasuryMovementsHistory } from "@/components/tesoreria/treasury-movements-history"
import { TreasuryProvider, useTreasury } from "@/components/tesoreria/treasury-provider"
import { TreasurySummaryCards } from "@/components/tesoreria/treasury-summary-cards"
import { TREASURY_MOVEMENT_TYPES } from "@/lib/tesoreria/categories"
import type { TreasuryMovementType } from "@/lib/tesoreria/categories"
import { Button } from "@/components/ui/button"

function TreasuryModuleContent() {
  const { canWrite } = useTreasury()
  const [formType, setFormType] = useState<TreasuryMovementType | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tesorería</h1>
        <p className="text-sm text-muted-foreground">
          Registro operativo de ingresos y egresos. No es un módulo contable.
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
        {!canWrite ? (
          <p className="self-center text-xs text-muted-foreground">
            Solo lectura. La edición está disponible para Administración.
          </p>
        ) : null}
      </div>

      <TreasuryMovementsHistory />

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
