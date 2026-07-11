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
  layout?: "inline" | "stacked"
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
        <SelectTrigger id={id} className="h-9 w-full">
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
  layout = "inline",
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

  const titleField = (
    <div className="min-w-0 space-y-1.5">
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
  )

  const typeField = (
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
        <SelectTrigger id={`checklist-type-${item.id}`} className="h-9 w-full">
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
  )

  const requiredField = (
    <YesNoSelect
      id={`checklist-required-${item.id}`}
      label="Obligatorio"
      value={item.required}
      disabled={disabled}
      onChange={(required) => void onUpdate(item.id, { required })}
    />
  )

  const deleteButton = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="shrink-0 text-destructive hover:text-destructive"
      disabled={disabled}
      aria-label="Eliminar ítem"
      onClick={() => void onDelete(item.id)}
    >
      <Trash2 className="size-4" />
    </Button>
  )

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
          className="mt-2 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing"
          aria-label="Arrastrar para reordenar"
          disabled={disabled}
        >
          <GripVertical className="size-4" />
        </button>

        {layout === "stacked" ? (
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex items-end gap-2">
              {titleField}
              {deleteButton}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
              {typeField}
              {requiredField}
            </div>
          </div>
        ) : (
          <div className="grid min-w-0 flex-1 gap-4 md:grid-cols-[minmax(0,1.4fr)_180px_120px_auto] md:items-end">
            {titleField}
            {typeField}
            {requiredField}
            {deleteButton}
          </div>
        )}
      </div>
    </article>
  )
}
