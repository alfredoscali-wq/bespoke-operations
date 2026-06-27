"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  XCircle,
} from "lucide-react"

import { useCustomers } from "@/components/clientes/customers-provider"
import { useCrews } from "@/components/cuadrillas/crews-provider"
import { useDemoMode } from "@/components/demo/demo-mode-provider"
import { useTasks } from "@/components/tareas/tasks-provider"
import { blockDemoWrite } from "@/lib/demo/demo-write-block"
import { getAssignableCrews } from "@/lib/crews/status-workflow"
import { executeWorkOrderImport } from "@/lib/tasks/work-order-import/execute"
import { parseWorkOrderImportFile } from "@/lib/tasks/work-order-import/parse"
import { downloadImportReport } from "@/lib/tasks/work-order-import/report"
import { downloadWorkOrderImportTemplate } from "@/lib/tasks/work-order-import/template"
import {
  formatImportDateDisplay,
  parseImportDate,
  resolveImportServiceType,
} from "@/lib/tasks/work-order-import/normalize"
import type {
  WorkOrderImportEditableField,
  WorkOrderImportExecutionResult,
  WorkOrderImportReportRow,
  WorkOrderImportReviewRow,
} from "@/lib/tasks/work-order-import/types"
import {
  applyValidationToRow,
  buildImportReviewRows,
  getImportRowObservations,
  getImportServiceTypeDisplay,
  getImportStatusLabel,
  summarizeImportRows,
  type ImportValidationContext,
} from "@/lib/tasks/work-order-import/validate"
import { WORK_ORDER_SERVICE_TYPE_OPTIONS } from "@/lib/tasks/work-order"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type WorkOrderImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported?: (message: string) => void
}

type ImportStep = "upload" | "review" | "result"

function buildAnalysisReportRows(
  rows: WorkOrderImportReviewRow[]
): WorkOrderImportReportRow[] {
  return rows.map((row) => ({
    fila: row.rowNumber,
    resultado: getImportStatusLabel(row.status),
    error: row.issues
      .filter((issue) => issue.level === "error")
      .map((issue) => issue.message)
      .join(" · "),
    sugerencia: row.issues
      .map((issue) => issue.suggestion)
      .filter(Boolean)
      .join(" · "),
  }))
}

function ImportSummaryBanner({
  summary,
}: {
  summary: ReturnType<typeof summarizeImportRows>
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="text-sm font-medium text-foreground">
        {summary.total} filas analizadas
      </p>
      <div className="mt-2 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-1.5 text-emerald-700">
          <CheckCircle2 className="size-4" />
          {summary.valid} válidas
        </span>
        <span className="inline-flex items-center gap-1.5 text-amber-700">
          <AlertTriangle className="size-4" />
          {summary.warnings} advertencias
        </span>
        <span className="inline-flex items-center gap-1.5 text-destructive">
          <XCircle className="size-4" />
          {summary.errors} errores
        </span>
      </div>
    </div>
  )
}

export function WorkOrderImportDialog({
  open,
  onOpenChange,
  onImported,
}: WorkOrderImportDialogProps) {
  const { isReadOnly, openRestrictedDialog } = useDemoMode()
  const { tasks, addTask } = useTasks()
  const { createCustomer, getImportDuplicateIndex } = useCustomers()
  const { crews } = useCrews()
  const assignableCrews = useMemo(() => getAssignableCrews(crews), [crews])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importCustomers, setImportCustomers] = useState<
    Awaited<ReturnType<typeof getImportDuplicateIndex>>
  >([])

  const [step, setStep] = useState<ImportStep>("upload")
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<WorkOrderImportReviewRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [executionResult, setExecutionResult] =
    useState<WorkOrderImportExecutionResult | null>(null)

  const validationContext = useMemo<ImportValidationContext>(
    () => ({
      crews: assignableCrews,
      customers: importCustomers as ImportValidationContext["customers"],
    }),
    [assignableCrews, importCustomers]
  )

  useEffect(() => {
    if (!open) {
      setImportCustomers([])
      return
    }

    void getImportDuplicateIndex().then(setImportCustomers)
  }, [open, getImportDuplicateIndex])

  const summary = useMemo(() => summarizeImportRows(rows), [rows])
  const selectedImportableCount = useMemo(
    () =>
      rows.filter((row) => row.selected && row.status !== "error").length,
    [rows]
  )

  const resetDialog = useCallback(() => {
    setStep("upload")
    setFileName(null)
    setRows([])
    setError(null)
    setExecutionResult(null)
    setIsParsing(false)
    setIsImporting(false)
  }, [])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetDialog()
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange, resetDialog]
  )

  const updateRowField = useCallback(
    (rowId: string, field: WorkOrderImportEditableField, value: string) => {
      setRows((current) =>
        current.map((row) => {
          if (row.id !== rowId) return row

          const nextData = { ...row.data, [field]: value }

          if (field === "serviceType") {
            nextData.serviceType = resolveImportServiceType(value)
          }

          if (field === "scheduledDate") {
            nextData.scheduledDate = parseImportDate(value) ?? value
          }

          return applyValidationToRow(
            {
              ...row,
              data: nextData,
            },
            validationContext
          )
        })
      )
    },
    [validationContext]
  )

  const updateRowCrew = useCallback(
    (rowId: string, crewId: string) => {
      setRows((current) =>
        current.map((row) => {
          if (row.id !== rowId) return row

          const crew = assignableCrews.find((item) => item.id === crewId)
          return applyValidationToRow(
            {
              ...row,
              data: {
                ...row.data,
                crewId: crew?.id ?? "",
                crewName: crew?.name ?? "",
              },
            },
            validationContext
          )
        })
      )
    },
    [assignableCrews, validationContext]
  )

  const toggleRowSelected = useCallback((rowId: string, selected: boolean) => {
    setRows((current) =>
      current.map((row) =>
        row.id === rowId ? { ...row, selected } : row
      )
    )
  }, [])

  const excludeErrorRows = useCallback(() => {
    setRows((current) =>
      current.map((row) =>
        row.status === "error" ? { ...row, selected: false } : row
      )
    )
  }, [])

  async function handleFileSelected(file: File | null) {
    if (!file) return

    setError(null)
    setIsParsing(true)

    try {
      const parsed = await parseWorkOrderImportFile(file)
      const reviewed = buildImportReviewRows(parsed.rows, validationContext)
      setRows(reviewed)
      setFileName(parsed.fileName)
      setStep("review")
    } catch (parseError) {
      setError(
        parseError instanceof Error
          ? parseError.message
          : "No se pudo analizar el archivo."
      )
    } finally {
      setIsParsing(false)
    }
  }

  async function handleImport() {
    if (blockDemoWrite(isReadOnly, openRestrictedDialog)) {
      return
    }

    setError(null)
    setIsImporting(true)

    try {
      const result = await executeWorkOrderImport({
        rows,
        existingTasks: tasks,
        customers: importCustomers as ImportValidationContext["customers"],
        crews: assignableCrews,
        createCustomer,
        addTask,
      })

      setExecutionResult(result)
      setStep("result")
      onImported?.(
        `${result.imported} órdenes importadas (${result.importedWithWarnings} con advertencias, ${result.excluded} excluidas).`
      )
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "No se pudo completar la importación."
      )
    } finally {
      setIsImporting(false)
    }
  }

  function handleDownloadReport(format: "csv" | "xlsx") {
    const reportRows =
      executionResult?.reportRows ?? buildAnalysisReportRows(rows)
    downloadImportReport(reportRows, format)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-6xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" />
            Importar órdenes de trabajo
          </DialogTitle>
          <DialogDescription>
            Excel → Analizar → Corregir → Seleccionar → Importar
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center">
              <Upload className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">
                Suba un archivo Excel operativo
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Formatos aceptados: .xlsx, .xls
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  className="gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsing}
                >
                  <FileSpreadsheet className="size-4" />
                  {isParsing ? "Analizando..." : "Seleccionar archivo"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() =>
                    downloadWorkOrderImportTemplate({
                      crewNames: assignableCrews.map((crew) => crew.name),
                    })
                  }
                >
                  <Download className="size-4" />
                  Descargar plantilla
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  void handleFileSelected(file)
                  event.target.value = ""
                }}
              />
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <ImportSummaryBanner summary={summary} />
            {fileName && (
              <p className="text-xs text-muted-foreground">
                Archivo: {fileName}
              </p>
            )}

            <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead className="w-14">Fila</TableHead>
                    <TableHead>Tipo de Orden</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Cuadrilla</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Observaciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Checkbox
                          checked={row.selected}
                          onCheckedChange={(checked) =>
                            toggleRowSelected(row.id, checked === true)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.rowNumber}
                      </TableCell>
                      <TableCell className="min-w-[180px]">
                        <Select
                          value={row.data.serviceType || undefined}
                          onValueChange={(value) =>
                            updateRowField(row.id, "serviceType", value)
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Tipo">
                              {getImportServiceTypeDisplay(row.data)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {WORK_ORDER_SERVICE_TYPE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="min-w-[180px]">
                        <Input
                          value={row.data.customerName}
                          onChange={(event) =>
                            updateRowField(
                              row.id,
                              "customerName",
                              event.target.value
                            )
                          }
                          placeholder="(vacío)"
                          className={cn(
                            "h-8",
                            row.issues.some(
                              (issue) =>
                                issue.field === "customerName" &&
                                issue.level === "error"
                            ) && "border-destructive"
                          )}
                        />
                      </TableCell>
                      <TableCell className="min-w-[140px]">
                        <Input
                          type="date"
                          value={row.data.scheduledDate}
                          onChange={(event) =>
                            updateRowField(
                              row.id,
                              "scheduledDate",
                              event.target.value
                            )
                          }
                          className="h-8"
                        />
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {formatImportDateDisplay(row.data.scheduledDate)}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-[160px]">
                        <Select
                          value={row.data.crewId || "none"}
                          onValueChange={(value) =>
                            updateRowCrew(
                              row.id,
                              value === "none" ? "" : value
                            )
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Cuadrilla">
                              {row.data.crewName || "Sin cuadrilla"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin cuadrilla</SelectItem>
                            {assignableCrews.map((crew) => (
                              <SelectItem key={crew.id} value={crew.id}>
                                {crew.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "text-xs font-medium",
                            row.status === "valid" && "text-emerald-700",
                            row.status === "warning" && "text-amber-700",
                            row.status === "error" && "text-destructive"
                          )}
                        >
                          {getImportStatusLabel(row.status)}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-[220px] text-xs text-muted-foreground">
                        {getImportRowObservations(row)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {step === "result" && executionResult && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border bg-muted/20 p-4 text-sm">
              <p className="font-medium text-foreground">
                {executionResult.analyzed} filas analizadas
              </p>
              <p className="mt-3 text-emerald-700">
                ✓ {executionResult.imported} importadas
              </p>
              <p className="mt-1 text-amber-700">
                ⚠ {executionResult.importedWithWarnings} importadas con
                advertencias
              </p>
              <p className="mt-1 text-destructive">
                ✗ {executionResult.excluded + executionResult.failed} excluidas
              </p>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(step === "review" || step === "result") && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => handleDownloadReport("xlsx")}
                >
                  <Download className="size-4" />
                  Descargar Excel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => handleDownloadReport("csv")}
                >
                  <Download className="size-4" />
                  Descargar CSV
                </Button>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {step === "review" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={excludeErrorRows}
                >
                  Excluir filas con errores
                </Button>
                <Button
                  type="button"
                  onClick={handleImport}
                  disabled={isImporting || selectedImportableCount === 0}
                >
                  {isImporting
                    ? "Importando..."
                    : `Importar órdenes seleccionadas (${selectedImportableCount})`}
                </Button>
              </>
            )}
            {step === "result" && (
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Cerrar
              </Button>
            )}
            {step !== "result" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancelar
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
