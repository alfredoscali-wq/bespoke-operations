"use client"

import { useState } from "react"

import { OperationalChecklistEditor } from "@/components/configuracion/operational-checklist-editor"
import { cn } from "@/lib/utils"
import {
  WORK_ORDER_SERVICE_TYPE_OPTIONS,
  type WorkOrderServiceType,
} from "@/lib/tasks/work-order"

type WorkOrderTypesConfigModuleProps = {
  readOnly?: boolean
}

export function WorkOrderTypesConfigModule({
  readOnly = false,
}: WorkOrderTypesConfigModuleProps) {
  const [selectedType, setSelectedType] = useState<WorkOrderServiceType>(
    WORK_ORDER_SERVICE_TYPE_OPTIONS[0]?.value ?? "instalacion-nueva"
  )

  const selectedLabel =
    WORK_ORDER_SERVICE_TYPE_OPTIONS.find((option) => option.value === selectedType)
      ?.label ?? selectedType

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Tipos de Orden de Trabajo
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure el checklist operativo asociado a cada tipo de OT de su empresa.
        </p>
      </div>

      <div className="grid min-h-[520px] gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <section className="rounded-xl border bg-card shadow-sm">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Tipos de OT</h2>
            <p className="text-xs text-muted-foreground">
              Seleccione un tipo para configurar su checklist.
            </p>
          </div>
          <ul className="p-2">
            {WORK_ORDER_SERVICE_TYPE_OPTIONS.map((option) => {
              const selected = option.value === selectedType

              return (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => setSelectedType(option.value)}
                    className={cn(
                      "w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                      selected
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground hover:bg-muted/50"
                    )}
                  >
                    {option.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-4 shadow-sm md:p-6">
          <OperationalChecklistEditor
            key={selectedType}
            serviceType={selectedType}
            serviceTypeLabel={selectedLabel}
            readOnly={readOnly}
          />
        </section>
      </div>
    </div>
  )
}
