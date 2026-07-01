"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

import { OperationalChecklistItemRow } from "@/components/configuracion/operational-checklist-item-row"
import { useWorkOrderTypeChecklist } from "@/components/configuracion/use-work-order-type-checklist"
import { Button } from "@/components/ui/button"
import type { WorkOrderServiceType } from "@/lib/tasks/work-order"

type OperationalChecklistEditorProps = {
  serviceType: WorkOrderServiceType
  serviceTypeLabel: string
  readOnly?: boolean
}

export function OperationalChecklistEditor({
  serviceType,
  serviceTypeLabel,
  readOnly = false,
}: OperationalChecklistEditorProps) {
  const {
    items,
    isLoading,
    isSaving,
    error,
    addItem,
    updateItem,
    deleteItem,
    reorderItems,
  } = useWorkOrderTypeChecklist(serviceType)

  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">
          Checklist Operativo
        </h2>
        <p className="text-sm text-muted-foreground">
          Ítems de verificación para{" "}
          <span className="font-medium text-foreground">{serviceTypeLabel}</span>.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando checklist...</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/15 px-4 py-10 text-center">
          <p className="text-sm font-medium text-foreground">
            Este tipo de OT aún no tiene ítems de checklist.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Agregue el primer ítem para definir el recorrido operativo.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <OperationalChecklistItemRow
              key={item.id}
              item={item}
              disabled={readOnly || isSaving}
              onUpdate={updateItem}
              onDelete={deleteItem}
              onDragStart={setDraggedId}
              onDragOver={setDropTargetId}
              onDrop={(targetId) => {
                if (draggedId && draggedId !== targetId) {
                  void reorderItems(draggedId, targetId)
                }
                setDraggedId(null)
                setDropTargetId(null)
              }}
              isDragging={draggedId === item.id}
              isDropTarget={dropTargetId === item.id && draggedId !== item.id}
            />
          ))}
        </div>
      )}

      {!readOnly ? (
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={isSaving}
          onClick={() => void addItem()}
        >
          <Plus className="size-4" />
          Agregar ítem
        </Button>
      ) : null}
    </section>
  )
}
