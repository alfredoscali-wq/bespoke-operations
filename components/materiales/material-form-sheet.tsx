"use client"

import { useEffect, useState } from "react"

import { uploadAttachmentFile } from "@/lib/attachments/client"
import { MaterialPhotoField } from "@/components/materiales/material-photo-field"
import {
  MaterialsFormSection,
  MaterialsSheetShell,
} from "@/components/materiales/materials-sheet-shell"
import {
  MATERIAL_CATEGORY_OPTIONS,
  MATERIAL_ITEM_TYPE_OPTIONS,
} from "@/lib/materials/constants"
import {
  formatDuplicateActiveMaterialCodeMessage,
  hasActiveCatalogCodeConflict,
  mapMaterialCodeErrorMessage,
} from "@/lib/materials/material-code"
import {
  categoryChangeAffectsUnit,
  formatUnitLabel,
  getCategoryUnitRule,
  normalizeMaterialUnit,
  resolveUnitForCategory,
  SELECTABLE_MATERIAL_UNITS,
  type MaterialUnitCode,
} from "@/lib/materials/units"
import type {
  MaterialCatalogItem,
  MaterialCategory,
  MaterialItemType,
  WarehouseSelectionContext,
} from "@/lib/types/materials"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

type MaterialFormSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  material?: MaterialCatalogItem | null
  activeCatalog?: MaterialCatalogItem[]
  warehouseContext?: WarehouseSelectionContext | null
  stockQuantity?: number
  hasInventoryHistory?: boolean
  onSaved: () => void
  onOpenWarehouseAdmin?: () => void
}

type FormState = {
  code: string
  name: string
  category: MaterialCategory
  unit: MaterialUnitCode
  itemType: MaterialItemType
  minStock: string
  warehouseId: string
  manufacturer: string
  description: string
  active: boolean
}

const defaultForm = (): FormState => ({
  code: "",
  name: "",
  category: "consumables",
  unit: "un",
  itemType: "consumable",
  minStock: "0",
  warehouseId: "",
  manufacturer: "",
  description: "",
  active: true,
})

export function MaterialFormSheet({
  open,
  onOpenChange,
  material,
  activeCatalog = [],
  warehouseContext,
  stockQuantity = 0,
  hasInventoryHistory = false,
  onSaved,
  onOpenWarehouseAdmin,
}: MaterialFormSheetProps) {
  const isEdit = Boolean(material)
  const [form, setForm] = useState<FormState>(defaultForm())
  const [error, setError] = useState<string | null>(null)
  const [categoryWarning, setCategoryWarning] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [photoAttachmentId, setPhotoAttachmentId] = useState<string | null>(null)
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null)
  const [photoWarning, setPhotoWarning] = useState<string | null>(null)
  const [initialCategory, setInitialCategory] = useState<MaterialCategory | null>(
    null
  )

  const unitRule = getCategoryUnitRule(form.category)
  const unitLocked = unitRule.mode === "fixed"

  useEffect(() => {
    if (!open) return
    setError(null)
    setCategoryWarning(false)
    setPhotoWarning(null)
    setPendingPhotoFile(null)
    if (material) {
      setInitialCategory(material.category)
      setForm({
        code: material.code,
        name: material.name,
        category: material.category,
        unit: resolveUnitForCategory(material.category, material.unit),
        itemType: material.itemType,
        minStock: String(material.minStock),
        warehouseId: "",
        manufacturer: material.manufacturer,
        description: material.description,
        active: material.active,
      })
      setPhotoAttachmentId(material.photoAttachmentId ?? null)
    } else {
      setInitialCategory(null)
      setPhotoAttachmentId(null)
      setForm(defaultForm())
    }
  }, [open, material])

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleCategoryChange(category: MaterialCategory) {
    const nextUnit = resolveUnitForCategory(category, form.unit)
    setForm((prev) => ({ ...prev, category, unit: nextUnit }))

    if (
      isEdit &&
      initialCategory &&
      stockQuantity > 0 &&
      categoryChangeAffectsUnit(initialCategory, category, form.unit)
    ) {
      setCategoryWarning(true)
    } else {
      setCategoryWarning(false)
    }
  }

  async function persistPhotoAttachment(attachmentId: string | null) {
    if (!material?.id) return
    const response = await fetch(`/api/materiales/materials/${material.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photoAttachmentId: attachmentId,
        clearPhoto: attachmentId === null,
      }),
    })
    const body = (await response.json()) as {
      success: boolean
      message?: string
    }
    if (!response.ok || !body.success) {
      setError(
        mapMaterialCodeErrorMessage(
          body.message ?? "No se pudo actualizar la foto."
        )
      )
      return
    }
    setPhotoAttachmentId(attachmentId)
  }

  async function uploadPendingPhoto(materialId: string, file: File) {
    const upload = await uploadAttachmentFile({
      module: "materials",
      recordId: materialId,
      file,
    })
    if (!upload.success) {
      return {
        ok: false as const,
        message: upload.message,
      }
    }

    const attachment = upload.attachment as { id?: string }
    if (!attachment?.id) {
      return {
        ok: false as const,
        message: "No se recibió el identificador de la foto.",
      }
    }

    const response = await fetch(`/api/materiales/materials/${materialId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        photoAttachmentId: attachment.id,
      }),
    })
    const body = (await response.json()) as {
      success: boolean
      message?: string
    }
    if (!response.ok || !body.success) {
      return {
        ok: false as const,
        message:
          mapMaterialCodeErrorMessage(
            body.message ?? "No se pudo asociar la foto al material."
          ),
      }
    }

    return { ok: true as const, attachmentId: attachment.id }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setPhotoWarning(null)

    const trimmedCode = form.code.trim()
    if (
      hasActiveCatalogCodeConflict(
        activeCatalog,
        trimmedCode,
        isEdit ? material?.id : undefined
      )
    ) {
      setError(formatDuplicateActiveMaterialCodeMessage(trimmedCode))
      return
    }

    if (
      isEdit &&
      categoryWarning &&
      !window.confirm(
        "Cambiar la categoría puede cambiar la unidad de medida y afectar cómo se interpreta el stock existente. ¿Desea continuar?"
      )
    ) {
      return
    }

    setIsSaving(true)

    const minStock = Number.parseFloat(form.minStock)
    const normalizedUnit = normalizeMaterialUnit(
      resolveUnitForCategory(form.category, form.unit)
    )
    const payload = {
      code: trimmedCode,
      name: form.name.trim(),
      category: form.category,
      unit: normalizedUnit,
      type: form.itemType,
      minStock: Number.isFinite(minStock) ? minStock : 0,
      manufacturer: form.manufacturer.trim(),
      description: form.description.trim(),
      active: form.active,
    }

    try {
      const url = isEdit
        ? `/api/materiales/materials/${material!.id}`
        : "/api/materiales/materials"
      const response = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = (await response.json()) as {
        success: boolean
        message?: string
        material?: MaterialCatalogItem
      }

      if (!response.ok || !body.success) {
        setError(
          mapMaterialCodeErrorMessage(
            body.message ?? "No se pudo guardar el material."
          )
        )
        return
      }

      if (!isEdit && pendingPhotoFile && body.material?.id) {
        const photoResult = await uploadPendingPhoto(
          body.material.id,
          pendingPhotoFile
        )
        if (!photoResult.ok) {
          setPhotoWarning(
            `El material fue creado, pero la foto no pudo asociarse: ${photoResult.message} Podés reintentar desde Editar material.`
          )
          setPendingPhotoFile(null)
          onSaved()
          return
        }
      }

      onSaved()
      onOpenChange(false)
    } catch {
      setError("Error de conexión al guardar el material.")
    } finally {
      setIsSaving(false)
    }
  }

  const formId = isEdit ? "edit-material-form" : "create-material-form"

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        type="button"
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={isSaving}
      >
        Cancelar
      </Button>
      <Button
        type="submit"
        form={formId}
        disabled={isSaving}
      >
        {isSaving
          ? "Guardando..."
          : isEdit
            ? "Guardar cambios"
            : "Crear material"}
      </Button>
    </div>
  )

  const unitField = unitLocked ? (
    <div className="space-y-2">
      <Label>Unidad</Label>
      <Select value={form.unit} disabled>
        <SelectTrigger className="bg-muted/40">
          <SelectValue>{formatUnitLabel(form.unit)}</SelectValue>
        </SelectTrigger>
      </Select>
      <p className="text-xs text-muted-foreground">
        Determinada por la categoría del material.
      </p>
    </div>
  ) : (
    <div className="space-y-2">
      <Label>Unidad</Label>
      <Select
        value={form.unit}
        onValueChange={(value) =>
          updateField("unit", value as MaterialUnitCode)
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SELECTABLE_MATERIAL_UNITS.map((unit) => (
            <SelectItem key={unit} value={unit}>
              {formatUnitLabel(unit)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  return (
    <MaterialsSheetShell
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Editar material" : "Nuevo material de catálogo"}
      description={
        isEdit
          ? "Modifique los datos del catálogo. El stock se gestiona con movimientos."
          : "Define un material en el catálogo. El stock se carga con Registrar entrada."
      }
      footer={footer}
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-6">
        <MaterialsFormSection title="Identificación">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="material-code">Código</Label>
              <Input
                id="material-code"
                value={form.code}
                onChange={(e) => updateField("code", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="material-name">Nombre</Label>
              <Input
                id="material-name"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select
                value={form.category}
                onValueChange={(value) =>
                  handleCategoryChange(value as MaterialCategory)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.itemType}
                onValueChange={(value) =>
                  updateField("itemType", value as MaterialItemType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATERIAL_ITEM_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </MaterialsFormSection>

        <MaterialsFormSection title="Inventario">
          <div className="grid gap-4 sm:grid-cols-2">
            {unitField}
            {isEdit ? (
              <div className="space-y-2">
                <Label>Stock actual</Label>
                <Input
                  readOnly
                  disabled
                  className="bg-muted/40 tabular-nums"
                  value={
                    stockQuantity > 0 || hasInventoryHistory
                      ? `${stockQuantity.toLocaleString("es-MX")} ${formatUnitLabel(form.unit)}`
                      : "Sin stock registrado"
                  }
                />
                <p className="text-xs text-muted-foreground">
                  El stock se modifica mediante entradas, salidas o ajustes.
                </p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="material-min-stock">Stock mínimo</Label>
              <Input
                id="material-min-stock"
                type="number"
                min={0}
                step="any"
                value={form.minStock}
                onChange={(e) => updateField("minStock", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Se genera una alerta cuando el stock disponible alcanza o baja
                de este valor.
              </p>
            </div>
          </div>
          {categoryWarning ? (
            <p className="mt-3 text-sm text-amber-700">
              Cambiar la categoría puede modificar la unidad y afectar cómo se
              interpreta el stock actual ({stockQuantity.toLocaleString("es-MX")}{" "}
              {formatUnitLabel(form.unit)}).
            </p>
          ) : null}
        </MaterialsFormSection>

        <MaterialsFormSection title="Información adicional">
          <div className="space-y-4">
            <MaterialPhotoField
              materialId={isEdit ? material?.id : null}
              photoAttachmentId={isEdit ? photoAttachmentId : null}
              pendingFile={isEdit ? null : pendingPhotoFile}
              onPendingFileChange={isEdit ? undefined : setPendingPhotoFile}
              disabled={isSaving}
              onPhotoAttachmentIdChange={
                isEdit ? persistPhotoAttachment : undefined
              }
            />
            <div className="space-y-2">
              <Label htmlFor="material-manufacturer">Fabricante</Label>
              <Input
                id="material-manufacturer"
                value={form.manufacturer}
                onChange={(e) => updateField("manufacturer", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="material-description">Descripción</Label>
              <Textarea
                id="material-description"
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={3}
              />
            </div>
          </div>
        </MaterialsFormSection>

        <MaterialsFormSection title="Estado">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Checkbox
              id="material-active"
              checked={form.active}
              onCheckedChange={(checked) =>
                updateField("active", checked === true)
              }
            />
            <div>
              <Label htmlFor="material-active" className="text-sm font-medium">
                Activo
              </Label>
              <p className="text-xs text-muted-foreground">
                Los materiales inactivos se marcan como descontinuados.
              </p>
            </div>
          </div>
        </MaterialsFormSection>

        {photoWarning ? (
          <p className="text-sm text-amber-700" role="status">{photoWarning}</p>
        ) : null}
        {error ? (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        ) : null}
      </form>
    </MaterialsSheetShell>
  )
}
