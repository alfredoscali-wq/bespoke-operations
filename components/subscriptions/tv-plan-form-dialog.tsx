"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { canChangeTvPlanCode } from "@/lib/subscriptions/tv-catalog"
import type { TvPlanWriteDraft } from "@/lib/subscriptions/tv-catalog"
import type { TvCatalogPlan } from "@/lib/types/subscriptions"

function emptyDraft(): TvPlanWriteDraft {
  return {
    name: "",
    code: "",
    monthlyPrice: "",
    isActive: true,
  }
}

export function TvPlanFormDialog({
  open,
  plan,
  onOpenChange,
  onSave,
}: {
  open: boolean
  plan: TvCatalogPlan | null
  onOpenChange: (open: boolean) => void
  onSave: (draft: TvPlanWriteDraft) => Promise<string | null>
}) {
  const [draft, setDraft] = useState<TvPlanWriteDraft>(emptyDraft())
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const codeLocked = plan ? !canChangeTvPlanCode(plan.usedCount) : false

  useEffect(() => {
    if (!open) return
    setError(null)
    if (plan) {
      setDraft({
        name: plan.name,
        code: plan.code,
        monthlyPrice: String(plan.monthlyPrice),
        isActive: plan.isActive,
      })
    } else {
      setDraft(emptyDraft())
    }
  }, [open, plan])

  async function handleSave() {
    setSaving(true)
    setError(null)
    const message = await onSave(draft)
    setSaving(false)
    if (message) {
      setError(message)
      return
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {plan ? "Editar plan TV" : "Nuevo plan TV"}
          </DialogTitle>
          <DialogDescription>
            El plan queda disponible para el componente TV de los servicios
            comerciales. El precio es el cargo TV interno, no el abono total.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="tv-plan-name">Nombre comercial</Label>
            <Input
              id="tv-plan-name"
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="TV Full"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tv-plan-code">Código</Label>
            <Input
              id="tv-plan-code"
              value={draft.code}
              onChange={(event) =>
                setDraft((current) => ({ ...current, code: event.target.value }))
              }
              placeholder="TV-FULL"
              disabled={codeLocked}
            />
            {codeLocked ? (
              <p className="text-xs text-muted-foreground">
                El código no se cambia porque el plan ya está en uso.
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tv-plan-price">Precio mensual</Label>
            <Input
              id="tv-plan-price"
              value={draft.monthlyPrice}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  monthlyPrice: event.target.value,
                }))
              }
              inputMode="decimal"
              placeholder="9900"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select
              value={draft.isActive ? "active" : "inactive"}
              onValueChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  isActive: value === "active",
                }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="inactive">Inactivo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
