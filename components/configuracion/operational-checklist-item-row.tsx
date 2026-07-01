"use client"

import { GripVertical, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { WorkOrderTypeChecklistItem } from "@/lib/types/work-order-type-checklist"
import {
  CHECKLIST_FIELD_TYPE_OPTIONS,
  type ChecklistFieldType,
} from "@/lib/work-order-types/checklist-field-types"
import { cn } from "@/lib/utils"

type OperationalChecklistItemRowProps = {
  item: WorkOrderTypeChecklistItem
  disabled?: boolean
  onUpdate: (
    id: string,
    patch: Partial<
      Pick<WorkOrderTypeChecklistItem, "title" | "fieldType" | "required">
    >
  ) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onDragStart: (id: string) => void
  onDragOver: (id: string) => void
  onDrop: (id: string) => void
  isDragging?: boolean
  isDropTarget?: boolean
}

function YesNoSelect({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string
  label: string
  value: boolean
  disabled?: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Select
        value={value ? "yes" : "no"}
        onValueChange={(next) => onChange(next === "yes")}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="yes">Sí</SelectItem>
          <SelectItem value="no">No</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

export function OperationalChecklistItemRow({
  item,
  disabled = false,
  onUpdate,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging = false,
  isDropTarget = false,
}: OperationalChecklistItemRowProps) {
  const [title, setTitle] = useState(item.title)

  useEffect(() => {
    setTitle(item.title)
  }, [item.title])

  return (
    <article
      draggable={!disabled}
      onDragStart={() => onDragStart(item.id)}
      onDragOver={(event) => {
        event.preventDefault()
        onDragOver(item.id)
      }}
      onDrop={(event) => {
        event.preventDefault()
        onDrop(item.id)
      }}
      className={cn(
        "rounded-xl border bg-card p-4 shadow-sm transition-colors",
        isDragging && "opacity-50",
        isDropTarget && "border-primary bg-primary/5"
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="mt-2 cursor-grab text-muted-foreground active:cursor-grabbing"
          aria-label="Arrastrar para reordenar"
          disabled={disabled}
        >
          <GripVertical className="size-4" />
        </button>

        <div className="grid min-w-0 flex-1 gap-4 md:grid-cols-[minmax(0,1.4fr)_180px_120px_auto] md:items-end">
          <div className="space-y-1.5">
            <Label
              htmlFor={`checklist-title-${item.id}`}
              className="text-xs text-muted-foreground"
            >
              Título
            </Label>
            <Input
              id={`checklist-title-${item.id}`}
              value={title}
              disabled={disabled}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => {
                const trimmed = title.trim()
                if (!trimmed || trimmed === item.title) {
                  setTitle(item.title)
                  return
                }

                void onUpdate(item.id, { title: trimmed })
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor={`checklist-type-${item.id}`}
              className="text-xs text-muted-foreground"
            >
              Tipo
            </Label>
            <Select
              value={item.fieldType}
              onValueChange={(value) =>
                void onUpdate(item.id, {
                  fieldType: value as ChecklistFieldType,
                })
              }
              disabled={disabled}
            >
              <SelectTrigger id={`checklist-type-${item.id}`} className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHECKLIST_FIELD_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <YesNoSelect
            id={`checklist-required-${item.id}`}
            label="Obligatorio"
            value={item.required}
            disabled={disabled}
            onChange={(required) => void onUpdate(item.id, { required })}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:text-destructive"
            disabled={disabled}
            aria-label="Eliminar ítem"
            onClick={() => void onDelete(item.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </article>
  )
}
