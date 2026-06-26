"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ShieldAlert, Trash2, Wrench } from "lucide-react"

import { fetchSystemAuditLogs } from "@/lib/admin/permanent-delete.client"
import {
  formatAuditEntityTypeLabel,
  formatAuditSeverityLabel,
} from "@/lib/audit/audit-labels"
import type { AuditLogEntry } from "@/lib/audit/types"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function formatEntityTypeLabel(entityType: AuditLogEntry["entityType"]) {
  return formatAuditEntityTypeLabel(entityType)
}

function formatAuditTimestamp(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(value))
}

export function SystemToolsPanel() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [auditError, setAuditError] = useState<string | null>(null)
  const [isLoadingAudit, setIsLoadingAudit] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadAudit() {
      setIsLoadingAudit(true)
      const result = await fetchSystemAuditLogs()

      if (cancelled) return

      if (!result.success || !result.entries) {
        setAuditError(result.message ?? "No se pudo cargar el Historial del Sistema.")
        setEntries([])
      } else {
        setAuditError(null)
        setEntries(result.entries)
      }

      setIsLoadingAudit(false)
    }

    void loadAudit()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Configuración del Sistema
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Herramientas de mantenimiento exclusivas para administradores.
        </p>
      </div>

      <Card className="border-destructive/30">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <ShieldAlert className="size-5" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base">Herramientas del Sistema</CardTitle>
              <CardDescription>
                Acciones de mantenimiento que no forman parte de la operación
                diaria.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="flex items-start gap-3">
              <Trash2 className="mt-0.5 size-4 text-destructive" />
              <div className="space-y-2">
                <p className="font-medium text-foreground">
                  Eliminar definitivamente
                </p>
                <p className="text-sm text-muted-foreground">
                  Borra físicamente un registro y toda su información
                  relacionada. Disponible desde el menú de acciones en{" "}
                  <Link href="/clientes" className="text-primary hover:underline">
                    Clientes
                  </Link>{" "}
                  y{" "}
                  <Link href="/tareas" className="text-primary hover:underline">
                    Órdenes de Trabajo
                  </Link>
                  .
                </p>
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  <p className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>
                      Eliminación permanente — no utiliza Soft Delete y no puede
                      deshacerse.
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-dashed bg-muted/10 px-4 py-3 text-sm text-muted-foreground">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <Wrench className="size-4" />
              Próximamente
            </p>
            <p className="mt-1">
              Limpiar datos de prueba, reiniciar datos operativos, reindexar
              información y otras herramientas de mantenimiento.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Historial del Sistema — eventos críticos
          </CardTitle>
          <CardDescription>
            Vista resumida. El módulo completo estará disponible en{" "}
            <Link href="/historial" className="text-primary hover:underline">
              Historial del Sistema
            </Link>
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAudit ? (
            <p className="text-sm text-muted-foreground">Cargando Historial del Sistema...</p>
          ) : auditError ? (
            <p className="text-sm text-destructive" role="alert">
              {auditError}
            </p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay eliminaciones permanentes registradas.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Fecha</TableHead>
                    <TableHead>Severidad</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Usuario</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatAuditTimestamp(entry.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatAuditSeverityLabel(entry.severity)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatEntityTypeLabel(entry.entityType)}
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate text-sm">
                        {entry.description}
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.performedByName}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
