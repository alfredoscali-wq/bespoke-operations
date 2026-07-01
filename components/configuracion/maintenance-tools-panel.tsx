"use client"

import Link from "next/link"
import { AlertTriangle, ArrowRight, ShieldAlert, Trash2, Wrench } from "lucide-react"

import { useIsSystemAdministrator } from "@/lib/auth/use-is-system-administrator"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function MaintenanceToolsPanel() {
  const isAdministrator = useIsSystemAdministrator()

  if (!isAdministrator) {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle>Acceso restringido</CardTitle>
          <CardDescription>
            Mantenimiento está disponible solo para administradores.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mantenimiento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Herramientas técnicas y administrativas para uso excepcional. No forman
          parte de la operación diaria.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Automatizaciones</CardTitle>
          <CardDescription>
            Reportes generados y enviados automáticamente por el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/reportes/automaticos?tab=configuracion"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Ir a Reportes Automáticos
            <ArrowRight className="size-4" />
          </Link>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <ShieldAlert className="size-5" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base">Herramientas del Sistema</CardTitle>
              <CardDescription>
                Acciones de mantenimiento y reparación de datos.
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
                  Borra físicamente un registro y toda su información relacionada.
                  Disponible desde el menú de acciones en{" "}
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
              información y otras herramientas de reparación.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
