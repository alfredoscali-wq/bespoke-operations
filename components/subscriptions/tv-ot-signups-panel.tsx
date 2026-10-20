"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { presentCustomerNumber } from "@/lib/subscriptions/customer-number-label"
import {
  countPendingTvOtSignups,
  TV_OT_LATAM_STATUS,
  TV_OT_PLAN_OPTIONS,
  type TvOtPlanKind,
  type TvOtSignupCategory,
  type TvOtSignupItem,
} from "@/lib/subscriptions/tv-ot-signups"
import { FILTER_SELECT_TRIGGER_CLASS, STATUS_TONE_STYLES } from "@/lib/ui/visual-tokens"
import { cn } from "@/lib/utils"

const CATEGORY_CLASS: Record<TvOtSignupCategory, string> = {
  approved_with_tv: STATUS_TONE_STYLES.green,
  approved_without_tv: STATUS_TONE_STYLES.blue,
  active_unverified: STATUS_TONE_STYLES.amber,
  pending_activation: STATUS_TONE_STYLES.yellow,
  cancelled: STATUS_TONE_STYLES.red,
  incorporated: STATUS_TONE_STYLES.violet,
}

const CATEGORY_FILTER: { value: TvOtSignupCategory | "possible_match" | "all"; label: string }[] = [
  { value: "all", label: "Todas las altas" },
  { value: "approved_with_tv", label: "Aprobada con TV" },
  { value: "approved_without_tv", label: "Aprobada sin TV" },
  { value: "active_unverified", label: "Activo sin OK" },
  { value: "pending_activation", label: "Pendiente de activación" },
  { value: "cancelled", label: "OT cancelada" },
  { value: "incorporated", label: "Ya incorporado" },
  { value: "possible_match", label: "Posible coincidencia" },
]

type ListResponse = {
  success?: boolean
  message?: string
  persistenceAvailable?: boolean
  items?: TvOtSignupItem[]
}

export function useTvOtSignupList() {
  const [items, setItems] = useState<TvOtSignupItem[]>([])
  const [persistenceAvailable, setPersistenceAvailable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/subscriptions/tv-ot-signups")
      const body = (await response.json()) as ListResponse
      if (!response.ok || !body.success || !body.items) {
        throw new Error(body.message || "No se pudieron cargar las altas de TV.")
      }
      setItems(body.items)
      setPersistenceAvailable(body.persistenceAvailable !== false)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las altas de TV.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const attentionCount = useMemo(() => countPendingTvOtSignups(items), [items])

  return {
    items,
    persistenceAvailable,
    loading,
    error,
    setError,
    notice,
    setNotice,
    load,
    attentionCount,
  }
}

type TvOtSignupFeed = ReturnType<typeof useTvOtSignupList>

function Chip({ className, children }: { className?: string; children: string }) {
  return (
    <span className={cn("inline-flex rounded border px-1.5 py-0.5 text-xs font-medium", className)}>
      {children}
    </span>
  )
}

export function TvOtSignupsPanel({
  canWrite,
  feed,
}: {
  canWrite: boolean
  feed: TvOtSignupFeed
}) {
  const {
    items,
    persistenceAvailable,
    loading,
    error,
    setError,
    notice,
    setNotice,
    load,
  } = feed
  const [filter, setFilter] = useState<(typeof CATEGORY_FILTER)[number]["value"]>("all")
  const [planItem, setPlanItem] = useState<TvOtSignupItem | null>(null)
  const [planKind, setPlanKind] = useState<TvOtPlanKind | "">("")
  const [incorporateItem, setIncorporateItem] = useState<TvOtSignupItem | null>(null)
  const [acknowledgeMatch, setAcknowledgeMatch] = useState(false)
  const [excludeItem, setExcludeItem] = useState<TvOtSignupItem | null>(null)
  const [saving, setSaving] = useState(false)

  const visible = useMemo(() => {
    if (filter === "all") return items
    if (filter === "possible_match") return items.filter((item) => item.possibleMatch)
    return items.filter((item) => item.category === filter)
  }, [filter, items])

  async function postJson(url: string, method: string, payload?: unknown) {
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    })
    const body = (await response.json()) as { success?: boolean; message?: string }
    if (!response.ok || !body.success) {
      throw new Error(body.message || "No se pudo completar la operación.")
    }
    return body.message ?? "Operación guardada."
  }

  async function savePlan() {
    if (!planItem || !planKind) return
    setSaving(true)
    setError(null)
    try {
      const message = await postJson(`/api/subscriptions/tv-ot-signups/${planItem.taskId}`, "PATCH", {
        tvKind: planKind,
      })
      setNotice(message)
      setPlanItem(null)
      void load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el plan.")
    } finally {
      setSaving(false)
    }
  }

  async function confirmIncorporate() {
    if (!incorporateItem) return
    setSaving(true)
    setError(null)
    try {
      const message = await postJson(
        `/api/subscriptions/tv-ot-signups/${incorporateItem.taskId}/incorporate`,
        "POST",
        { acknowledgePossibleMatch: acknowledgeMatch }
      )
      setNotice(message)
      setIncorporateItem(null)
      void load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo incorporar la alta.")
    } finally {
      setSaving(false)
    }
  }

  async function confirmExclude() {
    if (!excludeItem) return
    setSaving(true)
    setError(null)
    try {
      const message = await postJson(
        `/api/subscriptions/tv-ot-signups/${excludeItem.taskId}/exclude`,
        "POST",
        {}
      )
      setNotice(message)
      setExcludeItem(null)
      void load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo quitar la propuesta.")
    } finally {
      setSaving(false)
    }
  }

  const selectedOption = TV_OT_PLAN_OPTIONS.find((option) => option.kind === planKind) ?? null
  const writesDisabled = !canWrite || !persistenceAvailable || saving

  return (
    <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Altas pendientes de TV</h2>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Instalaciones nuevas de cualquier mes. Entran cuando la OT está finalizada y
            el cliente fue aprobado desde pendiente de activación. Nada se incorpora solo. {TV_OT_LATAM_STATUS}.
          </p>
        </div>
        <Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
          <SelectTrigger className={cn(FILTER_SELECT_TRIGGER_CLASS, "w-56")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_FILTER.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!persistenceAvailable ? (
        <p className="text-sm text-destructive" role="alert">
          La cola todavía no está disponible. El listado se puede ver, y las acciones se
          habilitan cuando la migración de propuestas esté aplicada.
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950" role="status">
          {notice}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando altas de TV…</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay altas para este filtro.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[72rem] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-2 py-2 font-medium">Cliente</th>
                <th className="px-2 py-2 font-medium">OT</th>
                <th className="px-2 py-2 font-medium">Activación</th>
                <th className="px-2 py-2 font-medium">Plan contratado</th>
                <th className="px-2 py-2 font-medium">Plan de TV</th>
                <th className="px-2 py-2 font-medium">N° Cliente</th>
                <th className="px-2 py-2 font-medium">Padrón</th>
                <th className="px-2 py-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr key={item.taskId} className="border-b align-top">
                  <td className="px-2 py-2">
                    <p className="font-medium">{item.customerName}</p>
                    <p className="text-xs text-muted-foreground">{presentCustomerNumber(item.customerNumber)}</p>
                    <Chip className={cn("mt-1", CATEGORY_CLASS[item.category])}>{item.categoryLabel}</Chip>
                  </td>
                  <td className="px-2 py-2">
                    <p>{item.taskCode}</p>
                    <p className="text-xs text-muted-foreground">{item.taskDate}</p>
                    <p className="text-xs">{item.taskStatusLabel}</p>
                    {item.taskOpen ? (
                      <Chip className={cn("mt-1", STATUS_TONE_STYLES.amber)}>OT abierta</Chip>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 text-xs">{item.activationLabel}</td>
                  <td className="px-2 py-2">{item.contractedPlan ?? "No disponible"}</td>
                  <td className="px-2 py-2">
                    <p>{item.proposedPlanLabel}</p>
                    {item.proposedPlanStructure ? (
                      <p className="text-xs text-muted-foreground">{item.proposedPlanStructure}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">{item.queueStatusLabel}</p>
                  </td>
                  <td className="px-2 py-2">
                    {presentCustomerNumber(item.abnetNumber ?? item.customerNumber) || "No disponible"}
                  </td>
                  <td className="px-2 py-2">
                    <p>
                      {item.padronPresence === "exact"
                        ? `En el padrón${item.padronPlanLabel ? `: ${item.padronPlanLabel}` : ""}`
                        : "Sin coincidencia"}
                    </p>
                    {item.possibleMatch ? (
                      <p className="mt-1 text-xs text-amber-800">
                        Posible coincidencia de nombre
                        {item.possibleMatchSample.length > 0
                          ? ` (${item.possibleMatchSample.join(", ")}${
                              item.possibleMatchCount > item.possibleMatchSample.length
                                ? ` y ${item.possibleMatchCount - item.possibleMatchSample.length} más`
                                : ""
                            })`
                          : ""}
                        . No demuestra que sea la misma persona.
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">{item.latamStatus}</p>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-col items-start gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={writesDisabled || !item.canEditPlan}
                        onClick={() => {
                          setPlanKind(item.selectedTvKind ?? item.suggestedTvKind ?? "")
                          setPlanItem(item)
                        }}
                      >
                        Editar plan
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={writesDisabled || !item.canIncorporate}
                        onClick={() => {
                          setAcknowledgeMatch(false)
                          setIncorporateItem(item)
                        }}
                      >
                        Incorporar a TV
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={writesDisabled || !item.canExclude}
                        onClick={() => setExcludeItem(item)}
                      >
                        Eliminar de la lista
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={planItem != null} onOpenChange={(open) => !open && setPlanItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Plan de TV</DialogTitle>
            <DialogDescription>
              {planItem
                ? `${planItem.customerName} · ${presentCustomerNumber(planItem.customerNumber)}. El plan contratado en la OT (${planItem.contractedPlan ?? "no disponible"}) queda como referencia y no se modifica.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <Select value={planKind || undefined} onValueChange={(value) => setPlanKind(value as TvOtPlanKind)}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar plan de TV" />
            </SelectTrigger>
            <SelectContent>
              {TV_OT_PLAN_OPTIONS.map((option) => (
                <SelectItem key={option.kind} value={option.kind}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedOption ? (
            <p className="text-sm text-muted-foreground">{selectedOption.structure}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Si la OT es solo de Internet, no hay un plan de TV propuesto hasta que lo elija.
            </p>
          )}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPlanItem(null)}>
              Cancelar
            </Button>
            <Button type="button" disabled={saving || !planKind} onClick={() => void savePlan()}>
              {saving ? "Guardando…" : "Guardar plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={incorporateItem != null} onOpenChange={(open) => !open && setIncorporateItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Incorporar a TV</DialogTitle>
            <DialogDescription>
              {incorporateItem
                ? `${incorporateItem.customerName} · ${incorporateItem.taskCode}. Plan: ${incorporateItem.proposedPlanLabel}.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {incorporateItem?.incorporateBlock ? (
            <p className="text-sm">{incorporateItem.incorporateBlock}</p>
          ) : incorporateItem ? (
            <p className="text-sm">
              El alta se incorpora al padrón con el N° de cliente{" "}
              {presentCustomerNumber(incorporateItem.abnetNumber ?? incorporateItem.customerNumber) ||
                "no disponible"}
              .
            </p>
          ) : null}
          {incorporateItem?.possibleMatch ? (
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={acknowledgeMatch}
                onCheckedChange={(checked) => setAcknowledgeMatch(checked === true)}
              />
              <span>
                Revisé la coincidencia de nombre y no la uso como identidad del cliente.
              </span>
            </label>
          ) : null}
          <p className="text-xs text-muted-foreground">{TV_OT_LATAM_STATUS}. Esta acción no llama a Latam.</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIncorporateItem(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={
                saving ||
                !incorporateItem?.selectedTvKind ||
                (incorporateItem.possibleMatch && !acknowledgeMatch)
              }
              onClick={() => void confirmIncorporate()}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={excludeItem != null} onOpenChange={(open) => !open && setExcludeItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar de la lista</DialogTitle>
            <DialogDescription>
              {excludeItem
                ? `${excludeItem.customerName} · ${excludeItem.taskCode} deja de mostrarse como alta pendiente. El cliente, la OT y el padrón no se borran.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExcludeItem(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={saving} onClick={() => void confirmExclude()}>
              Quitar de la lista
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
