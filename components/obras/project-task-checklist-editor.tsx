"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

import { OperationalChecklistItemRow } from "@/components/configuracion/operational-checklist-item-row"
import { Button } from "@/components/ui/button"
import {
  createOperationalChecklistTemplateItem,
  normalizeOperationalChecklistTemplate,
  reorderOperationalChecklistTemplateItems,
  toWorkOrderTypeChecklistItemShape,
  type OperationalChecklistTemplateItem,
} from "@/lib/tasks/operational-checklist-template"

type ProjectTaskChecklistEditorProps = {
  items: OperationalChecklistTemplateItem[]
  onChange: (items: OperationalChecklistTemplateItem[]) => void
  disabled?: boolean
}

const EDITOR_TEMPLATE_NORMALIZE_OPTIONS = { dropEmptyTitles: false } as const

export function ProjectTaskChecklistEditor({
  items,
  onChange,
  disabled = false,
}: ProjectTaskChecklistEditorProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  function updateItems(next: OperationalChecklistTemplateItem[]) {
    onChange(
      normalizeOperationalChecklistTemplate(next, EDITOR_TEMPLATE_NORMALIZE_OPTIONS)
    )
  }

  function handleAddItem() {
    updateItems([
      ...items,
      createOperationalChecklistTemplateItem(items.length + 1),
    ])
  }

  async function handleUpdate(
    id: string,
    patch: Partial<
      Pick<OperationalChecklistTemplateItem, "title" | "fieldType" | "required">
    >
  ) {
    updateItems(
      items.map((item) => (item.id === id ? { ...item, ...patch } : item))
    )
  }

  async function handleDelete(id: string) {
    updateItems(items.filter((item) => item.id !== id))
  }

  return (
    <section className="space-y-4" data-testid="project-task-checklist-editor">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">
          Checklist de trabajo
        </h3>
        <p className="text-xs text-muted-foreground">
          Defina los ítems que el operario deberá completar en Field Agent para
          esta orden de trabajo.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/15 px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Sin ítems de checklist. El operario podrá finalizar sin checklist
            obligatorio.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <OperationalChecklistItemRow
              key={item.id}
              item={toWorkOrderTypeChecklistItemShape(item)}
              disabled={disabled}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onDragStart={setDraggedId}
              onDragOver={setDropTargetId}
              onDrop={(targetId) => {
                if (draggedId && draggedId !== targetId) {
                  updateItems(
                    reorderOperationalChecklistTemplateItems(
                      items,
                      draggedId,
                      targetId,
                      EDITOR_TEMPLATE_NORMALIZE_OPTIONS
                    )
                  )
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

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        disabled={disabled}
        onClick={handleAddItem}
      >
        <Plus className="size-4" />
        Agregar ítem
      </Button>
    </section>
  )
}
