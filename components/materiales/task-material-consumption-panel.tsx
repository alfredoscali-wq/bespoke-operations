"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, PackageCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  computeQuantityReturned,
  validateConsumedQuantity,
} from "@/lib/materials/task-material-consumption"
import {
  confirmTaskMaterialConsumptionClient,
  fetchReservedTaskMaterialLinesClient,
} from "@/lib/materials/task-material-consumption.client"
import { formatUnitLabel } from "@/lib/materials/units"
import type { TaskMaterialLineView } from "@/lib/types/materials"

type TaskMaterialConsumptionPanelProps = {
  taskId: string
  onConfirmed?: () => void
  onError?: (message: string | null) => void
}

type ConsumptionMode = "choose" | "custom" | "done"

export function TaskMaterialConsumptionPanel({
  taskId,
  onConfirmed,
  onError,
}: TaskMaterialConsumptionPanelProps) {
  const [lines, setLines] = useState<TaskMaterialLineView[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mode, setMode] = useState<ConsumptionMode>("choose")
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    onError?.(null)

    void fetchReservedTaskMaterialLinesClient(taskId)
      .then((loaded) => {
        if (cancelled) return
        setLines(loaded)
        if (loaded.length === 0) {
          setMode("done")
        }
      })
      .catch((error) => {
        if (cancelled) return
        onError?.(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los materiales reservados."
        )
        setLines([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [taskId, onError])

  const hasReservedLines = lines.length > 0

  const previewRows = useMemo(() => {
    return lines.map((line) => {
      const reserved = line.quantityPlanned
      const parsed = Number.parseFloat(
        (quantities[line.id] ?? String(reserved)).trim().replace(",", ".")
      )
      const consumed = Number.isFinite(parsed) ? parsed : reserved
      return {
        line,
        reserved,
        consumed,
        returned: computeQuantityReturned(reserved, consumed),
      }
    })
  }, [lines, quantities])

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Cargando materiales…</p>
    )
  }

  if (!hasReservedLines || mode === "done") {
    return null
  }

  async function confirmAllUsed() {
    setValidationError(null)
    onError?.(null)
    setIsSubmitting(true)
    try {
      await confirmTaskMaterialConsumptionClient({ taskId, useAll: true })
      setMode("done")
      onConfirmed?.()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo confirmar los materiales."
      setValidationError(message)
      onError?.(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function confirmCustomQuantities() {
    setValidationError(null)
    onError?.(null)

    const payload: Array<{ lineId: string; quantityConsumed: number }> = []
    for (const line of lines) {
      const reserved = line.quantityPlanned
      const raw = quantities[line.id] ?? ""
      const validation = validateConsumedQuantity({
        unit: line.unit,
        quantityReserved: reserved,
        quantityConsumed: raw,
      })
      if (!validation.ok) {
        setValidationError(validation.message)
        onError?.(validation.message)
        return
      }
      payload.push({
        lineId: line.id,
        quantityConsumed: validation.quantity,
      })
    }

    setIsSubmitting(true)
    try {
      await confirmTaskMaterialConsumptionClient({
        taskId,
        useAll: false,
        lines: payload,
      })
      setMode("done")
      onConfirmed?.()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo confirmar los materiales."
      setValidationError(message)
      onError?.(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900 dark:bg-amber-950/40">
      <div className="flex items-start gap-3">
        <PackageCheck className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" />
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-amber-950 dark:text-amber-50">
            Materiales utilizados
          </h3>
          <p className="text-sm text-amber-900/90 dark:text-amber-100/90">
            Esta OT tiene materiales del catálogo reservados. Antes de finalizar
            la OT, confirmá los materiales utilizados.
          </p>
        </div>
      </div>

      {mode === "choose" ? (
        <>
          <p className="text-sm font-medium text-amber-950 dark:text-amber-50">
            ¿Se utilizaron todos los materiales?
          </p>
          <ul className="space-y-2 text-sm">
            {lines.map((line) => (
              <li
                key={line.id}
                className="rounded-lg border border-amber-200/80 bg-background/70 px-3 py-2 dark:border-amber-900"
              >
                <p className="font-medium">{line.materialName}</p>
                <p className="text-muted-foreground">
                  Reservado:{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {line.quantityPlanned.toLocaleString("es-AR")}{" "}
                    {formatUnitLabel(line.unit)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
          <div className="grid gap-2">
            <Button
              type="button"
              className="h-12 rounded-xl"
              disabled={isSubmitting}
              onClick={() => void confirmAllUsed()}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Sí, se utilizaron todos"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-xl"
              disabled={isSubmitting}
              onClick={() => {
                setMode("custom")
                setQuantities(
                  Object.fromEntries(
                    lines.map((line) => [line.id, String(line.quantityPlanned)])
                  )
                )
              }}
            >
              No, modificar cantidades
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-3">
            {previewRows.map(({ line, reserved, consumed, returned }) => (
              <div
                key={line.id}
                className="rounded-lg border border-amber-200/80 bg-background/70 p-3 dark:border-amber-900"
              >
                <p className="font-medium">{line.materialName}</p>
                <p className="text-sm text-muted-foreground">
                  Reservado: {reserved.toLocaleString("es-AR")}{" "}
                  {formatUnitLabel(line.unit)}
                </p>
                <div className="mt-2 space-y-2">
                  <Label htmlFor={`consumed-${line.id}`}>Utilizado</Label>
                  <Input
                    id={`consumed-${line.id}`}
                    type="number"
                    min={0}
                    step={line.unit === "m" ? "any" : "1"}
                    value={quantities[line.id] ?? ""}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [line.id]: event.target.value,
                      }))
                    }
                    className="tabular-nums"
                  />
                  <p className="text-xs text-muted-foreground">
                    Devuelto: {returned.toLocaleString("es-AR")}{" "}
                    {formatUnitLabel(line.unit)}
                    {Number.isFinite(consumed) && consumed !== reserved
                      ? ` · Utilizado: ${consumed.toLocaleString("es-AR")}`
                      : null}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              disabled={isSubmitting}
              onClick={() => setMode("choose")}
            >
              Volver
            </Button>
            <Button
              type="button"
              className="h-11 rounded-xl"
              disabled={isSubmitting}
              onClick={() => void confirmCustomQuantities()}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Confirmar materiales"
              )}
            </Button>
          </div>
        </>
      )}

      {validationError ? (
        <p className="text-sm text-destructive" role="alert">
          {validationError}
        </p>
      ) : null}
    </div>
  )
}
