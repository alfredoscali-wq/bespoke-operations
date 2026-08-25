"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Download, Upload } from "lucide-react"

import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { canAccessIspMigration } from "@/lib/isp/permissions"
import {
  ISP_MIGRATION_NO_REAL_DATA_MESSAGE,
  ISP_MIGRATION_NO_REAL_DATA_REVIEW_HINT,
  ISP_MIGRATION_NO_REAL_DATA_REVIEW_TITLE,
} from "@/lib/isp/migration/constants"
import type { IspMigrationIssue } from "@/lib/isp/migration/types"
import type { IspMigrationRunSummary } from "@/lib/isp/migration/types"
import type { IspMigrationSheetCounts } from "@/lib/isp/migration/types"
import type { IspMigrationReviewItem } from "@/lib/isp/migration/review"

type ValidationResponse = {
  success: boolean
  imported?: boolean
  message?: string
  run?: IspMigrationRunSummary
  counts?: Record<string, IspMigrationSheetCounts>
  preview?: {
    customers: number
    catalog: number
    services: number
    connections: number
    equipment: number
    warnings: number
    errors: number
    examplesIgnored?: number
  }
  issues?: IspMigrationIssue[]
  canImport?: boolean
  hasRealData?: boolean
  duplicateCompletedRun?: boolean
}

type ReviewFilter = "all" | "valid" | "warning" | "error"
type WizardStep = "archivo" | "validacion" | "revision" | "confirmacion" | "resultado"

const STEPS: { id: WizardStep; label: string }[] = [
  { id: "archivo", label: "Archivo" },
  { id: "validacion", label: "Validación" },
  { id: "revision", label: "Revisión" },
  { id: "confirmacion", label: "Confirmación" },
  { id: "resultado", label: "Resultado" },
]

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("es-AR")
}

function statusLabel(status: string) {
  if (status === "completed") return "Completada"
  if (status === "pending_review" || status === "validated") {
    return "Pendiente de revisión"
  }
  if (status === "no_real_data") return "Sin datos reales"
  if (status === "validating") return "Validando"
  if (status === "rejected") return "Con errores"
  if (status === "failed") return "Error"
  return status
}

function examplesLabel(count: number) {
  if (count === 1) return "○ 1 ejemplo ignorado"
  return `○ ${count} ejemplos ignorados`
}

function reviewStatusLabel(status: IspMigrationReviewItem["status"]) {
  if (status === "valid") return "✓ Correcto"
  if (status === "warning") return "⚠ Revisar"
  return "✕ Error"
}

export function IspMigrationScreen() {
  const { sessionUser } = useAuth()
  const allowed = canAccessIspMigration(sessionUser)
  const [file, setFile] = useState<File | null>(null)
  const [step, setStep] = useState<WizardStep>("archivo")
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validation, setValidation] = useState<ValidationResponse | null>(null)
  const [reviewItems, setReviewItems] = useState<IspMigrationReviewItem[]>([])
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all")
  const [editing, setEditing] = useState<IspMigrationReviewItem | null>(null)
  const [editFields, setEditFields] = useState<IspMigrationReviewItem["editable"] | null>(
    null
  )
  const [runs, setRuns] = useState<IspMigrationRunSummary[]>([])
  const [cutoffAt, setCutoffAt] = useState<string | null>(null)

  function loadHistory() {
    fetch("/api/isp/migration/runs")
      .then(async (response) => {
        const body = (await response.json()) as {
          success: boolean
          runs?: IspMigrationRunSummary[]
          cutoffAt?: string | null
        }
        if (body.success) {
          setRuns(body.runs ?? [])
          setCutoffAt(body.cutoffAt ?? null)
        }
      })
      .catch(() => undefined)
  }

  useEffect(() => {
    if (allowed) loadHistory()
  }, [allowed])

  const preview = validation?.preview
  const run = validation?.run
  const hasRealData = Boolean(
    validation?.hasRealData ??
      ((preview?.customers ?? 0) +
        (preview?.catalog ?? 0) +
        (preview?.services ?? 0) +
        (preview?.connections ?? 0) >
        0)
  )
  const canConfirm = Boolean(
    run?.id &&
      validation?.canImport &&
      hasRealData &&
      (preview?.errors ?? run?.errorsCount ?? 0) === 0 &&
      (run.status === "pending_review" || run.status === "validated")
  )

  const visibleReview = useMemo(() => {
    if (reviewFilter === "all") return reviewItems
    return reviewItems.filter((item) => item.status === reviewFilter)
  }, [reviewFilter, reviewItems])

  async function loadReview(runId: string, nextValidation?: ValidationResponse) {
    const response = await fetch(`/api/isp/migration/runs/${runId}/review`)
    const body = (await response.json()) as {
      success: boolean
      items?: IspMigrationReviewItem[]
      run?: IspMigrationRunSummary
      message?: string
    }
    if (!body.success) {
      throw new Error(body.message ?? "No se pudieron cargar los pendientes.")
    }
    setReviewItems(body.items ?? [])
    if (body.run) {
      setValidation((current) => ({
        success: true,
        ...(nextValidation ?? current ?? {}),
        run: body.run,
        canImport: (body.run?.errorsCount ?? 0) === 0,
      }))
    }
  }

  async function handleValidate() {
    if (!file) {
      setError("Seleccione un archivo Excel.")
      return
    }
    setLoading(true)
    setError(null)
    setStep("validacion")
    try {
      const form = new FormData()
      form.append("file", file)
      const response = await fetch("/api/isp/migration/validate", {
        method: "POST",
        body: form,
      })
      const body = (await response.json()) as ValidationResponse
      if (!body.success) {
        throw new Error(body.message ?? "No se pudo validar el archivo.")
      }
      setValidation(body)
      if (body.run?.id && body.run.status !== "no_real_data") {
        await loadReview(body.run.id, body)
      } else {
        setReviewItems([])
      }
      setStep(body.run?.status === "no_real_data" ? "validacion" : "revision")
      loadHistory()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error inesperado.")
      setStep("archivo")
    } finally {
      setLoading(false)
    }
  }

  async function handleImport(forceReimport = false) {
    const runId = validation?.run?.id
    if (!runId) return
    setImporting(true)
    setError(null)
    setStep("confirmacion")
    try {
      const response = await fetch(`/api/isp/migration/runs/${runId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceReimport }),
      })
      const body = (await response.json()) as {
        success: boolean
        message?: string
        needsForce?: boolean
        run?: IspMigrationRunSummary
      }
      if (!body.success) {
        throw new Error(body.message ?? "No se pudo confirmar la migración.")
      }
      setValidation((current) =>
        current
          ? {
              ...current,
              run: body.run ?? current.run,
              canImport: false,
            }
          : current
      )
      setStep("resultado")
      loadHistory()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error inesperado.")
    } finally {
      setImporting(false)
    }
  }

  async function openHistoryRun(historyRun: IspMigrationRunSummary) {
    setError(null)
    setValidation({
      success: true,
      run: historyRun,
      canImport:
        historyRun.errorsCount === 0 &&
        (historyRun.status === "pending_review" ||
          historyRun.status === "validated"),
      hasRealData: historyRun.status !== "no_real_data",
      preview: {
        customers: historyRun.customersCount,
        catalog: historyRun.catalogCount,
        services: historyRun.servicesCount,
        connections: historyRun.connectionsCount,
        equipment: historyRun.equipmentCount,
        warnings: historyRun.warningsCount,
        errors: historyRun.errorsCount,
        examplesIgnored:
          typeof historyRun.summary.examplesIgnored === "number"
            ? historyRun.summary.examplesIgnored
            : 0,
      },
    })
    if (historyRun.status === "completed") {
      setStep("resultado")
      return
    }
    if (historyRun.status === "no_real_data") {
      setReviewItems([])
      setStep("validacion")
      return
    }
    try {
      await loadReview(historyRun.id)
      setStep("revision")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error inesperado.")
    }
  }

  async function saveCorrection() {
    if (!editing || !editFields || !run?.id) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/isp/migration/runs/${run.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerRowId: editing.customerRowId,
          serviceRowId: editing.serviceRowId,
          connectionRowId: editing.connectionRowId,
          fields: editFields,
        }),
      })
      const body = (await response.json()) as {
        success: boolean
        message?: string
        items?: IspMigrationReviewItem[]
        run?: IspMigrationRunSummary
        preview?: ValidationResponse["preview"]
        counts?: ValidationResponse["counts"]
        canImport?: boolean
      }
      if (!body.success) {
        throw new Error(body.message ?? "No se pudo guardar la corrección.")
      }
      setReviewItems(body.items ?? [])
      setValidation((current) => ({
        success: true,
        ...current,
        run: body.run ?? current?.run,
        preview: body.preview ?? current?.preview,
        counts: body.counts ?? current?.counts,
        canImport: body.canImport,
      }))
      setEditing(null)
      setEditFields(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error inesperado.")
    } finally {
      setSaving(false)
    }
  }

  if (!allowed) {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Acceso restringido</CardTitle>
          <CardDescription>
            La migración de abonados está disponible para perfiles autorizados
            de Clientes 360° y mantenimiento.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/clientes-360"
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Clientes 360°
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Migración de abonados
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Importá los abonados, servicios y conexiones actuales del ISP.
            Los datos se revisan antes de incorporarse al sistema.
          </p>
        </div>
      </div>

      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((item, index) => {
          const currentIndex = STEPS.findIndex((stepItem) => stepItem.id === step)
          const done = index < currentIndex
          const active = item.id === step
          return (
            <li
              key={item.id}
              className={
                active
                  ? "rounded-full bg-primary px-3 py-1 text-primary-foreground"
                  : done
                    ? "rounded-full bg-muted px-3 py-1"
                    : "rounded-full px-3 py-1 text-muted-foreground"
              }
            >
              {item.label}
              {done ? " ✓" : active ? " →" : ""}
            </li>
          )
        })}
      </ol>

      {cutoffAt ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fecha de corte ISP</CardTitle>
            <CardDescription>
              Desde {formatDate(cutoffAt)} Bespoke gestiona las nuevas altas
              ISP. Las OT anteriores permanecen como historial operativo.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Archivo</CardTitle>
          <CardDescription>
            Completá los datos reales. Las filas marcadas como DATOS DE EJEMPLO
            se ignoran automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a href="/api/isp/migration/template">
                <Download className="size-4" />
                Descargar plantilla
              </a>
            </Button>
            <Button asChild variant="outline">
              <label className="cursor-pointer">
                <Upload className="size-4" />
                Seleccionar archivo
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="sr-only"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null)
                    setStep("archivo")
                  }}
                />
              </label>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {file ? file.name : "Ningún archivo seleccionado."}
          </p>
          <Button onClick={handleValidate} disabled={loading || !file}>
            {loading ? "Validando..." : "Validar archivo"}
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {run?.status === "no_real_data"
                ? "Validación completada"
                : "Resultado de validación"}
            </CardTitle>
            <CardDescription>
              Migración: {run?.filename ?? "—"}. Estado:{" "}
              {statusLabel(run?.status ?? "pending_review")}. Las contraseñas
              PPPoE no se muestran.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {run?.status === "no_real_data" ? (
              <p className="text-sm">{ISP_MIGRATION_NO_REAL_DATA_MESSAGE}</p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {(
                [
                  ["CLIENTES", "Abonados"],
                  ["SERVICIOS", "Servicios"],
                  ["CONEXIONES", "Conexiones"],
                  ["CATALOGO", "Catálogo"],
                  ["EQUIPAMIENTO", "Equipamiento"],
                ] as const
              ).map(([key, label]) => {
                const counts = validation?.counts?.[key]
                return (
                  <div key={key} className="rounded-lg border bg-muted/20 p-3">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      ✓ {counts?.valid ?? 0} válidos
                      <br />⚠ {counts?.warnings ?? 0} advertencias
                      <br />✕ {counts?.errors ?? 0} errores
                      <br />
                      {examplesLabel(counts?.examples ?? 0)}
                    </p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {run ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Abonados pendientes de revisión
            </CardTitle>
            <CardDescription>
              Migración: {run.filename}. Estado: {statusLabel(run.status)}.
              {hasRealData
                ? ` Resumen: ${run.customersCount} abonados, ${run.servicesCount} servicios, ${run.connectionsCount} conexiones, ${run.errorsCount} errores, ${run.warningsCount} advertencias.`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasRealData ? (
              <div className="space-y-2 text-sm">
                <p>{ISP_MIGRATION_NO_REAL_DATA_REVIEW_TITLE}</p>
                <p className="text-muted-foreground">
                  {ISP_MIGRATION_NO_REAL_DATA_REVIEW_HINT}
                </p>
                <Button disabled>Confirmar migración</Button>
              </div>
            ) : (
              <>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "Todos"],
                  ["valid", "Correctos"],
                  ["warning", "Advertencias"],
                  ["error", "Errores"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={reviewFilter === value ? "default" : "outline"}
                  onClick={() => setReviewFilter(value)}
                >
                  {label}
                </Button>
              ))}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Abonado</TableHead>
                  <TableHead>DNI/CUIT</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Conexión</TableHead>
                  <TableHead>Estado de validación</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleReview.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No hay registros para este filtro.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleReview.map((item) => (
                    <TableRow key={item.key}>
                      <TableCell>{item.subscriberName || "—"}</TableCell>
                      <TableCell>{item.dni || "—"}</TableCell>
                      <TableCell>{item.serviceName}</TableCell>
                      <TableCell>{item.connectionLabel}</TableCell>
                      <TableCell>{reviewStatusLabel(item.status)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditing(item)
                            setEditFields(item.editable)
                          }}
                        >
                          Corregir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {itemIssues(visibleReview).length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {itemIssues(visibleReview)[0]}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep("archivo")}>
                Cargar versión corregida
              </Button>
              <Button
                onClick={() => setStep("confirmacion")}
                disabled={!canConfirm}
              >
                Confirmar migración
              </Button>
            </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {step === "confirmacion" && preview && hasRealData ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confirmar migración</CardTitle>
            <CardDescription>
              Se incorporarán los registros revisados. La importación es
              transaccional: si falla, no quedan datos parciales.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>Se incorporarán:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>{preview.customers} abonados</li>
              <li>{preview.services} servicios</li>
              <li>{preview.connections} conexiones</li>
              <li>{preview.equipment} elementos de equipamiento</li>
            </ul>
            <p>Advertencias: {preview.warnings}</p>
            {validation?.duplicateCompletedRun ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
                Este archivo ya fue importado. Para volver a procesar IDs
                nuevos debe confirmar una reimportación explícita.
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep("revision")}>
                Volver a revisar
              </Button>
              {validation?.duplicateCompletedRun ? (
                <Button
                  onClick={() => handleImport(true)}
                  disabled={!canConfirm || importing}
                >
                  {importing ? "Confirmando..." : "Reimportar explícitamente"}
                </Button>
              ) : (
                <Button
                  onClick={() => handleImport(false)}
                  disabled={!canConfirm || importing}
                >
                  {importing ? "Confirmando..." : "Confirmar migración"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === "resultado" && run ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultado</CardTitle>
            <CardDescription>
              {run.resultMessage || statusLabel(run.status)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {run.status === "completed" ? (
              <>
                <p>Abonados importados: {run.importedCustomersCount}</p>
                <p>Servicios importados: {run.importedServicesCount}</p>
                <p>Conexiones importadas: {run.importedConnectionsCount}</p>
                <p>Equipamiento importado: {run.importedEquipmentCount}</p>
                <Button asChild>
                  <Link href="/clientes-360">Ver listado de abonados</Link>
                </Button>
              </>
            ) : (
              <p>La migración no se completó.</p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de migraciones</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay migraciones registradas.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Archivo</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Abonados</TableHead>
                  <TableHead>Servicios</TableHead>
                  <TableHead>Conexiones</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((historyRun) => (
                  <TableRow
                    key={historyRun.id}
                    className="cursor-pointer"
                    onClick={() => openHistoryRun(historyRun)}
                  >
                    <TableCell>{formatDate(historyRun.startedAt)}</TableCell>
                    <TableCell>{historyRun.filename}</TableCell>
                    <TableCell>{historyRun.createdByLabel ?? "—"}</TableCell>
                    <TableCell>
                      {historyRun.status === "completed"
                        ? historyRun.importedCustomersCount
                        : historyRun.customersCount}
                    </TableCell>
                    <TableCell>
                      {historyRun.status === "completed"
                        ? historyRun.importedServicesCount
                        : historyRun.servicesCount}
                    </TableCell>
                    <TableCell>
                      {historyRun.status === "completed"
                        ? historyRun.importedConnectionsCount
                        : historyRun.connectionsCount}
                    </TableCell>
                    <TableCell>{statusLabel(historyRun.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(editing && editFields)}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null)
            setEditFields(null)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Corregir registro pendiente</DialogTitle>
            <DialogDescription>
              El valor se guarda en el registro pendiente. No modifica todavía
              los abonados definitivos.
            </DialogDescription>
          </DialogHeader>
          {editFields ? (
            <div className="grid gap-3">
              <FieldInput
                label="Nombre / razón social"
                value={editFields.nombre_razon_social}
                onChange={(value) =>
                  setEditFields({ ...editFields, nombre_razon_social: value })
                }
              />
              <FieldInput
                label="DNI/CUIT"
                value={editFields.dni_cuit}
                onChange={(value) =>
                  setEditFields({ ...editFields, dni_cuit: value })
                }
              />
              <FieldInput
                label="Localidad"
                value={editFields.localidad}
                onChange={(value) =>
                  setEditFields({ ...editFields, localidad: value })
                }
              />
              <FieldInput
                label="Domicilio"
                value={editFields.domicilio}
                onChange={(value) =>
                  setEditFields({ ...editFields, domicilio: value })
                }
              />
              <FieldInput
                label="Estado del abonado"
                value={editFields.estado_cliente}
                onChange={(value) =>
                  setEditFields({ ...editFields, estado_cliente: value })
                }
              />
              <FieldInput
                label="Servicio"
                value={editFields.nombre_servicio}
                onChange={(value) =>
                  setEditFields({ ...editFields, nombre_servicio: value })
                }
              />
              <FieldInput
                label="Estado comercial"
                value={editFields.estado_comercial}
                onChange={(value) =>
                  setEditFields({ ...editFields, estado_comercial: value })
                }
              />
              <FieldInput
                label="Precio mensual"
                value={editFields.precio_mensual}
                onChange={(value) =>
                  setEditFields({ ...editFields, precio_mensual: value })
                }
              />
              <FieldInput
                label="Tipo de conexión"
                value={editFields.tipo_conexion}
                onChange={(value) =>
                  setEditFields({ ...editFields, tipo_conexion: value })
                }
              />
              <FieldInput
                label="Estado técnico"
                value={editFields.estado_tecnico}
                onChange={(value) =>
                  setEditFields({ ...editFields, estado_tecnico: value })
                }
              />
              <FieldInput
                label="IP"
                value={editFields.ip}
                onChange={(value) =>
                  setEditFields({ ...editFields, ip: value })
                }
              />
              <FieldInput
                label="Usuario PPPoE"
                value={editFields.usuario_pppoe}
                onChange={(value) =>
                  setEditFields({ ...editFields, usuario_pppoe: value })
                }
              />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditing(null)
                setEditFields(null)
              }}
            >
              Cancelar
            </Button>
            <Button onClick={saveCorrection} disabled={saving}>
              {saving ? "Guardando..." : "Guardar corrección"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FieldInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function itemIssues(items: IspMigrationReviewItem[]) {
  return items.flatMap((item) => item.issues.map((issue) => issue.message))
}
