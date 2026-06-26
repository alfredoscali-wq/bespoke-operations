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
import { executeCustomerImport } from "@/lib/customers/customer-import/execute"
import { parseCustomerImportFile } from "@/lib/customers/customer-import/parse"
import { downloadImportReport } from "@/lib/customers/customer-import/report"
import { downloadCustomerImportTemplate } from "@/lib/customers/customer-import/template"
import {
  resolveImportStatus,
  resolveImportTechnology,
} from "@/lib/customers/customer-import/normalize"
import type {
  CustomerImportEditableField,
  CustomerImportExecutionResult,
  CustomerImportReportRow,
  CustomerImportReviewRow,
} from "@/lib/customers/customer-import/types"
import {
  applyValidationToRow,
  buildImportReviewRows,
  getImportRowObservations,
  getImportStatusLabel,
  summarizeImportRows,
  type ImportValidationContext,
} from "@/lib/customers/customer-import/validate"
import { formatCustomerStatusLabel } from "@/lib/customers/format"
import type { Customer } from "@/lib/types/customers"
import { WORK_ORDER_TECHNOLOGY_OPTIONS } from "@/lib/tasks/work-order"
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

type CustomerImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported?: (message: string) => void
}

type ImportStep = "upload" | "review" | "result"

const STATUS_OPTIONS = [
  { value: "activo", label: "Activo" },
  { value: "inactivo", label: "Inactivo" },
] as const

function buildAnalysisReportRows(
  rows: CustomerImportReviewRow[]
): CustomerImportReportRow[] {
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
  selectedCount,
}: {
  summary: ReturnType<typeof summarizeImportRows>
  selectedCount: number
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
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <CheckCircle2 className="size-4 text-primary" />
          {selectedCount} seleccionadas
        </span>
      </div>
    </div>
  )
}

function getTechnologyDisplay(value: string): string {
  if (!value) return "(vacío)"
  return (
    WORK_ORDER_TECHNOLOGY_OPTIONS.find((option) => option.value === value)
      ?.label ?? value
  )
}

export function CustomerImportDialog({
  open,
  onOpenChange,
  onImported,
}: CustomerImportDialogProps) {
  const { createCustomer, getImportDuplicateIndex } = useCustomers()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importCustomers, setImportCustomers] = useState<Customer[]>([])

  const [step, setStep] = useState<ImportStep>("upload")
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<CustomerImportReviewRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [executionResult, setExecutionResult] =
    useState<CustomerImportExecutionResult | null>(null)

  const validationContext = useMemo<ImportValidationContext>(
    () => ({ customers: importCustomers }),
    [importCustomers]
  )

  useEffect(() => {
    if (!open) {
      setImportCustomers([])
      return
    }

    void getImportDuplicateIndex().then((index) => {
      setImportCustomers(index as Customer[])
    })
  }, [open, getImportDuplicateIndex])

  const summary = useMemo(() => summarizeImportRows(rows), [rows])
  const selectedCount = useMemo(
    () => rows.filter((row) => row.selected).length,
    [rows]
  )
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
    (rowId: string, field: CustomerImportEditableField, value: string) => {
      setRows((current) =>
        current.map((row) => {
          if (row.id !== rowId) return row

          const nextData = { ...row.data, [field]: value }

          if (field === "technology") {
            nextData.technology = resolveImportTechnology(value)
          }

          if (field === "status") {
            nextData.status = resolveImportStatus(value)
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
      const parsed = await parseCustomerImportFile(file)
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
    setError(null)
    setIsImporting(true)

    try {
      const result = await executeCustomerImport({
        rows,
        customers: importCustomers,
        createCustomer,
      })

      setExecutionResult(result)
      setStep("result")
      onImported?.(
        `${result.imported} clientes importados (${result.importedWithWarnings} con advertencias, ${result.excluded} excluidos, ${result.failed} fallidos).`
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

  function hasFieldError(
    row: CustomerImportReviewRow,
    field: CustomerImportEditableField
  ) {
    return row.issues.some(
      (issue) => issue.field === field && issue.level === "error"
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-6xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" />
            Importar Clientes
          </DialogTitle>
          <DialogDescription>
            {step === "upload"
              ? "Importe clientes desde un archivo Excel (.xlsx)."
              : "Excel → Analizar → Corregir → Seleccionar → Importar"}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center">
              <Upload className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">
                Suba un archivo Excel con clientes
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
                  onClick={() => downloadCustomerImportTemplate()}
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
            <ImportSummaryBanner summary={summary} selectedCount={selectedCount} />
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
                    <TableHead>Código Externo</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Tecnología</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Validación</TableHead>
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
                      <TableCell className="min-w-[140px]">
                        <Input
                          value={row.data.externalCustomerCode}
                          onChange={(event) =>
                            updateRowField(
                              row.id,
                              "externalCustomerCode",
                              event.target.value
                            )
                          }
                          placeholder="(vacío)"
                          className={cn(
                            "h-8",
                            hasFieldError(row, "externalCustomerCode") &&
                              "border-destructive"
                          )}
                        />
                      </TableCell>
                      <TableCell className="min-w-[160px]">
                        <Input
                          value={row.data.name}
                          onChange={(event) =>
                            updateRowField(row.id, "name", event.target.value)
                          }
                          placeholder="(vacío)"
                          className={cn(
                            "h-8",
                            hasFieldError(row, "name") && "border-destructive"
                          )}
                        />
                      </TableCell>
                      <TableCell className="min-w-[130px]">
                        <Input
                          value={row.data.phone}
                          onChange={(event) =>
                            updateRowField(row.id, "phone", event.target.value)
                          }
                          placeholder="Teléfono"
                          className="h-8"
                        />
                        <Input
                          value={row.data.email}
                          onChange={(event) =>
                            updateRowField(row.id, "email", event.target.value)
                          }
                          placeholder="Email"
                          className={cn(
                            "mt-1 h-8",
                            hasFieldError(row, "email") && "border-destructive"
                          )}
                        />
                      </TableCell>
                      <TableCell className="min-w-[150px]">
                        <Select
                          value={row.data.technology || "none"}
                          onValueChange={(value) =>
                            updateRowField(
                              row.id,
                              "technology",
                              value === "none" ? "" : value
                            )
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Tecnología">
                              {getTechnologyDisplay(row.data.technology)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">(vacío)</SelectItem>
                            {WORK_ORDER_TECHNOLOGY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="min-w-[130px]">
                        <Select
                          value={row.data.status || "activo"}
                          onValueChange={(value) =>
                            updateRowField(row.id, "status", value)
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Estado">
                              {formatCustomerStatusLabel(
                                row.data.status || "activo"
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="min-w-[220px]">
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
                        <p className="mt-1 text-xs text-muted-foreground">
                          {getImportRowObservations(row)}
                        </p>
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
                {executionResult.analyzed} analizadas
              </p>
              <p className="mt-3 text-emerald-700">
                ✓ {executionResult.imported} importadas
              </p>
              <p className="mt-1 text-amber-700">
                ⚠ {executionResult.importedWithWarnings} importadas con
                advertencias
              </p>
              <p className="mt-1 text-muted-foreground">
                ○ {executionResult.excluded} excluidas
              </p>
              <p className="mt-1 text-destructive">
                ✗ {executionResult.failed} fallidas
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
                  Descargar XLSX
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
                    : `Importar seleccionadas (${selectedImportableCount})`}
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
