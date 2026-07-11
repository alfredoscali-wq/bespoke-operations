"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
} from "lucide-react"

import { useEmployees } from "@/components/rrhh/employees-provider"
import { useEmployeeTypes } from "@/components/configuracion/use-employee-types"
import { executeEmployeeImport } from "@/lib/employees/employee-import/execute"
import { parseEmployeeImportFile } from "@/lib/employees/employee-import/parse"
import { downloadEmployeeImportTemplate } from "@/lib/employees/employee-import/template"
import type {
  EmployeeImportExecutionResult,
  EmployeeImportReviewRow,
} from "@/lib/employees/employee-import/types"
import {
  buildImportReviewRows,
  getImportRowObservations,
  getImportStatusLabel,
  getPreviewAccessLabel,
  getPreviewEmployeeTypeLabel,
  getPreviewRoleLabel,
  summarizeImportRows,
  type EmployeeImportValidationContext,
} from "@/lib/employees/employee-import/validate"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type EmployeesImportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported?: (message: string) => void
}

type ImportStep = "upload" | "review" | "result"

function ImportSummaryBanner({
  summary,
}: {
  summary: ReturnType<typeof summarizeImportRows>
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="text-sm font-medium text-foreground">
        {summary.total} registros encontrados
      </p>
      <div className="mt-2 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-1.5 text-emerald-700">
          <CheckCircle2 className="size-4" />✓ {summary.valid} válidos
        </span>
        {summary.errors > 0 && (
          <span className="inline-flex items-center gap-1.5 text-amber-700">
            <AlertTriangle className="size-4" />⚠ {summary.errors} con errores
          </span>
        )}
      </div>
    </div>
  )
}

export function EmployeesImportDialog({
  open,
  onOpenChange,
  onImported,
}: EmployeesImportDialogProps) {
  const { employees, addEmployee, editEmployee } = useEmployees()
  const { items: employeeTypes } = useEmployeeTypes()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<ImportStep>("upload")
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<EmployeeImportReviewRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [executionResult, setExecutionResult] =
    useState<EmployeeImportExecutionResult | null>(null)

  const validationContext = useMemo<EmployeeImportValidationContext>(
    () => ({ employees, employeeTypes }),
    [employees, employeeTypes]
  )

  const summary = useMemo(() => summarizeImportRows(rows), [rows])
  const validCount = summary.valid

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

  async function handleFileSelected(file: File | null) {
    if (!file) return

    setError(null)
    setIsParsing(true)

    try {
      const parsed = await parseEmployeeImportFile(file)
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
      const result = await executeEmployeeImport({
        rows,
        addEmployee,
        editEmployee,
      })

      setExecutionResult(result)
      setStep("result")

      if (result.failed === 0 && result.skipped === 0) {
        onImported?.(`${result.created} empleados importados correctamente.`)
      } else {
        onImported?.(
          `${result.created} empleados creados, ${result.failed + result.skipped} errores.`
        )
      }
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-primary" />
            Importar empleados
          </DialogTitle>
          <DialogDescription>
            {step === "upload"
              ? "Importe personal desde un archivo Excel (.xlsx) con la plantilla RRHH."
              : step === "review"
                ? "Revise la vista previa antes de confirmar la importación."
                : "Resumen de la importación completada."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center">
              <Upload className="mx-auto size-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">
                Suba un archivo Excel con empleados
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
                  onClick={() => downloadEmployeeImportTemplate()}
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
              <p className="text-xs text-muted-foreground">Archivo: {fileName}</p>
            )}

            <div className="min-h-0 flex-1 overflow-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Fila</TableHead>
                    <TableHead>DNI</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Acceso</TableHead>
                    <TableHead>Validación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs">
                        {row.rowNumber}
                      </TableCell>
                      <TableCell>{row.data.nationalId.trim() || "—"}</TableCell>
                      <TableCell>
                        {[row.data.firstName, row.data.lastName]
                          .map((part) => part.trim())
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </TableCell>
                      <TableCell>
                        {getPreviewEmployeeTypeLabel(row, employeeTypes)}
                      </TableCell>
                      <TableCell>{getPreviewRoleLabel(row)}</TableCell>
                      <TableCell>{getPreviewAccessLabel(row)}</TableCell>
                      <TableCell className="min-w-[220px]">
                        <span
                          className={cn(
                            "text-xs font-medium",
                            row.status === "valid" && "text-emerald-700",
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
                Importación completada
              </p>
              <p className="mt-3 text-emerald-700">
                {executionResult.created} empleados creados
              </p>
              {(executionResult.failed > 0 || executionResult.skipped > 0) && (
                <p className="mt-1 text-destructive">
                  {executionResult.failed + executionResult.skipped} errores
                </p>
              )}
            </div>

            {executionResult.failures.length > 0 && (
              <div className="max-h-48 overflow-auto rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Fila</TableHead>
                      <TableHead>Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {executionResult.failures.map((failure) => (
                      <TableRow key={`${failure.rowNumber}-${failure.message}`}>
                        <TableCell className="font-mono text-xs">
                          {failure.rowNumber}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {failure.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          {step === "review" && (
            <Button
              type="button"
              onClick={handleImport}
              disabled={isImporting || validCount === 0}
            >
              {isImporting
                ? "Importando..."
                : `Importar empleados válidos (${validCount})`}
            </Button>
          )}
          {step === "result" ? (
            <Button type="button" onClick={() => handleOpenChange(false)}>
              Cerrar
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
