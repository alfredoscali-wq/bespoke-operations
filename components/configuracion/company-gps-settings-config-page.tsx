"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { canManageCompanyGpsSettings } from "@/lib/company-gps-settings/access"
import { DEFAULT_COMPANY_GPS_SETTINGS } from "@/lib/company-gps-settings/constants"
import type { CompanyGpsSettings } from "@/lib/company-gps-settings/types"
import { cn } from "@/lib/utils"

function GpsToggle({
  id,
  checked,
  onCheckedChange,
  label,
}: {
  id: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className="inline-flex cursor-pointer items-center gap-2 rounded-md text-left text-sm outline-none hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span
        aria-hidden
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-4 rounded-full bg-background shadow-sm transition-transform",
            checked && "translate-x-4"
          )}
        />
      </span>
      <span className={checked ? "font-medium" : "text-muted-foreground"}>
        {checked ? "Activada" : "Desactivada"}
      </span>
    </button>
  )
}

export function CompanyGpsSettingsConfigPage() {
  const { sessionUser, isAuthReady } = useAuth()
  const canManage = canManageCompanyGpsSettings(sessionUser)
  const [settings, setSettings] = useState<CompanyGpsSettings>(
    DEFAULT_COMPANY_GPS_SETTINGS
  )
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/company-gps-settings")
      const body = (await response.json()) as {
        success?: boolean
        settings?: CompanyGpsSettings
        message?: string
      }
      if (!response.ok || !body.success || !body.settings) {
        throw new Error(body.message ?? "No se pudo cargar la geolocalización.")
      }
      setSettings(body.settings)
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar la geolocalización."
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthReady || !canManage) {
      return
    }
    void loadSettings()
  }, [canManage, isAuthReady, loadSettings])

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setIsSaving(true)
    try {
      const response = await fetch("/api/company-gps-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      const body = (await response.json()) as {
        success?: boolean
        settings?: CompanyGpsSettings
        message?: string
      }
      if (!response.ok || !body.success || !body.settings) {
        throw new Error(body.message ?? "No se pudo guardar.")
      }
      setSettings(body.settings)
      setMessage("Configuración de geolocalización guardada.")
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "No se pudo guardar."
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (!isAuthReady) {
    return (
      <p className="text-sm text-muted-foreground">Verificando permisos…</p>
    )
  }

  if (!canManage) {
    return (
      <div className="rounded-xl border bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium">Acceso restringido</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Solo un administrador puede configurar la geolocalización.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/configuracion">Volver a Configuración</Link>
        </Button>
      </div>
    )
  }

  return (
    <form className="space-y-6" onSubmit={(event) => void handleSave(event)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Geolocalización
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Validación GPS al iniciar jornada y OT. La autoridad de control es el
          servidor, por empresa.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-emerald-700" role="status">
          {message}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando configuración…</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inicio de jornada</CardTitle>
              <CardDescription>
                Define el radio permitido alrededor de la ubicación de referencia para iniciar la jornada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Label htmlFor="shift-gps-toggle">
                  Validar GPS al iniciar jornada
                </Label>
                <GpsToggle
                  id="shift-gps-toggle"
                  checked={settings.shiftLocationValidationEnabled}
                  onCheckedChange={(value) =>
                    setSettings((current) => ({
                      ...current,
                      shiftLocationValidationEnabled: value,
                    }))
                  }
                  label="Validar GPS al iniciar jornada"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shift-radius">Radio de validación de jornada</Label>
                <div className="flex max-w-xs items-center gap-2">
                  <Input
                    id="shift-radius"
                    type="number"
                    min={1}
                    max={10000}
                    step={1}
                    disabled={!settings.shiftLocationValidationEnabled}
                    value={settings.shiftRadiusMeters}
                    onChange={(event) => {
                      const next = Number.parseInt(event.target.value, 10)
                      setSettings((current) => ({
                        ...current,
                        shiftRadiusMeters: Number.isFinite(next)
                          ? next
                          : current.shiftRadiusMeters,
                      }))
                    }}
                  />
                  <span className="text-sm text-muted-foreground">m</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {settings.shiftRadiusMeters} m
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Inicio de OT</CardTitle>
              <CardDescription>
                Define el radio permitido alrededor de la OT/obra para iniciar una OT.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Label htmlFor="task-gps-toggle">Validar GPS al iniciar OT</Label>
                <GpsToggle
                  id="task-gps-toggle"
                  checked={settings.taskLocationValidationEnabled}
                  onCheckedChange={(value) =>
                    setSettings((current) => ({
                      ...current,
                      taskLocationValidationEnabled: value,
                    }))
                  }
                  label="Validar GPS al iniciar OT"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-radius">Radio de validación de OT</Label>
                <div className="flex max-w-xs items-center gap-2">
                  <Input
                    id="task-radius"
                    type="number"
                    min={1}
                    max={10000}
                    step={1}
                    disabled={!settings.taskLocationValidationEnabled}
                    value={settings.taskRadiusMeters}
                    onChange={(event) => {
                      const next = Number.parseInt(event.target.value, 10)
                      setSettings((current) => ({
                        ...current,
                        taskRadiusMeters: Number.isFinite(next)
                          ? next
                          : current.taskRadiusMeters,
                      }))
                    }}
                  />
                  <span className="text-sm text-muted-foreground">m</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {settings.taskRadiusMeters} m
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">GPS en vivo</CardTitle>
              <CardDescription>
                Frecuencia con la que Mobile envía la última posición de la
                cuadrilla durante una jornada activa. Intervalo permitido: 30 a
                120 segundos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Label htmlFor="gps-heartbeat-toggle">
                  Enviar ubicación periódica
                </Label>
                <GpsToggle
                  id="gps-heartbeat-toggle"
                  checked={settings.gpsHeartbeatEnabled}
                  onCheckedChange={(value) =>
                    setSettings((current) => ({
                      ...current,
                      gpsHeartbeatEnabled: value,
                    }))
                  }
                  label="Enviar ubicación periódica"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gps-heartbeat-interval">
                  Intervalo de actualización
                </Label>
                <div className="flex max-w-xs items-center gap-2">
                  <Input
                    id="gps-heartbeat-interval"
                    type="number"
                    min={30}
                    max={120}
                    step={1}
                    disabled={!settings.gpsHeartbeatEnabled}
                    value={settings.gpsHeartbeatIntervalSeconds}
                    onChange={(event) => {
                      const next = Number.parseInt(event.target.value, 10)
                      setSettings((current) => ({
                        ...current,
                        gpsHeartbeatIntervalSeconds: Number.isFinite(next)
                          ? next
                          : current.gpsHeartbeatIntervalSeconds,
                      }))
                    }}
                  />
                  <span className="text-sm text-muted-foreground">s</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {settings.gpsHeartbeatIntervalSeconds} s
                </p>
              </div>
            </CardContent>
          </Card>

          <div>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </>
      )}
    </form>
  )
}
