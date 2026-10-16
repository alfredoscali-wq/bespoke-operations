"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
import { canManageMikrotikIntegrations } from "@/lib/integrations/mikrotik/access"
import type {
  MikrotikIntegrationPublic,
  MikrotikProtocol,
} from "@/lib/integrations/mikrotik/types"

type FormState = {
  name: string
  host: string
  port: string
  protocol: MikrotikProtocol
  username: string
  password: string
  enabled: boolean
}

const EMPTY_FORM: FormState = {
  name: "",
  host: "",
  port: "443",
  protocol: "https-rest",
  username: "",
  password: "",
  enabled: true,
}

function protocolLabel(protocol: MikrotikProtocol) {
  if (protocol === "https-rest") return "HTTPS / REST"
  if (protocol === "api-ssl") return "API-SSL"
  return "API"
}

function formatBytes(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—"
  const mb = value / (1024 * 1024)
  if (mb >= 1024) return (mb / 1024).toFixed(1) + " GB"
  return Math.round(mb) + " MB"
}

function formatCheckedAt(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

function StatusDot({
  status,
}: {
  status: MikrotikIntegrationPublic["lastConnectionStatus"]
}) {
  if (status === "connected") {
    return <span aria-hidden>🟢</span>
  }
  if (status === "error") {
    return <span aria-hidden>🔴</span>
  }
  if (status === "disabled") {
    return <span aria-hidden>⚪</span>
  }
  return <span aria-hidden>⚪</span>
}

function statusLabel(item: MikrotikIntegrationPublic) {
  if (!item.enabled || item.lastConnectionStatus === "disabled") return "Deshabilitado"
  if (item.lastConnectionStatus === "connected") return "Conectado"
  if (item.lastConnectionStatus === "error") return "Error de conexion"
  return "Sin comprobar"
}

export function MikrotikIntegrationsConfigPage() {
  const { sessionUser, isAuthReady } = useAuth()
  const canManage = canManageMikrotikIntegrations(sessionUser)
  const [items, setItems] = useState<MikrotikIntegrationPublic[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [viewItem, setViewItem] = useState<MikrotikIntegrationPublic | null>(null)
  const [editing, setEditing] = useState<MikrotikIntegrationPublic | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testMessage, setTestMessage] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/integrations/mikrotik")
      const body = (await response.json()) as {
        success?: boolean
        message?: string
        integrations?: MikrotikIntegrationPublic[]
      }
      if (!response.ok || !body.success) {
        throw new Error(body.message ?? "No se pudieron cargar los routers MikroTik.")
      }
      setItems(body.integrations ?? [])
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar los routers MikroTik."
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthReady || !canManage) return
    void loadItems()
  }, [canManage, isAuthReady, loadItems])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (item: MikrotikIntegrationPublic) => {
    setEditing(item)
    setForm({
      name: item.name,
      host: item.host,
      port: String(item.port),
      protocol: item.protocol,
      username: item.username,
      password: "",
      enabled: item.enabled,
    })
    setFormOpen(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name,
        host: form.host,
        port: Number.parseInt(form.port, 10),
        protocol: form.protocol,
        username: form.username,
        enabled: form.enabled,
        ...(form.password ? { password: form.password } : editing ? {} : { password: "" }),
      }
      const response = await fetch(
        editing
          ? "/api/integrations/mikrotik/" + editing.id
          : "/api/integrations/mikrotik",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )
      const body = (await response.json()) as {
        success?: boolean
        message?: string
        integration?: MikrotikIntegrationPublic
      }
      if (!response.ok || !body.success || !body.integration) {
        throw new Error(body.message ?? "No se pudo guardar el MikroTik.")
      }
      setFormOpen(false)
      await loadItems()
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "No se pudo guardar el MikroTik."
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleTest = async (item: MikrotikIntegrationPublic) => {
    setTestingId(item.id)
    setTestMessage(null)
    setError(null)
    try {
      const response = await fetch(
        "/api/integrations/mikrotik/" + item.id + "/test",
        { method: "POST" }
      )
      const body = (await response.json()) as {
        success?: boolean
        message?: string
        result?: {
          identity?: string | null
          version?: string | null
          uptime?: string | null
          cpuLoad?: string | null
          freeMemory?: number | null
          totalMemory?: number | null
        }
        integration?: MikrotikIntegrationPublic
      }
      if (body.integration) {
        setItems((current) =>
          current.map((row) => (row.id === body.integration?.id ? body.integration : row))
        )
        if (viewItem?.id === body.integration.id) {
          setViewItem(body.integration)
        }
      }
      if (!response.ok || !body.success) {
        throw new Error(body.message ?? "No se pudo conectar con el MikroTik.")
      }
      const result = body.result
      setTestMessage(
        [
          "Conexion exitosa",
          result?.identity ? "Router: " + result.identity : null,
          result?.version ? "RouterOS: " + result.version : null,
          result?.uptime ? "Uptime: " + result.uptime : null,
          result?.cpuLoad ? "CPU: " + result.cpuLoad + "%" : null,
          result?.totalMemory != null
            ? "Memoria: " +
              formatBytes(result.freeMemory ?? null) +
              " / " +
              formatBytes(result.totalMemory)
            : null,
        ]
          .filter(Boolean)
          .join("\n")
      )
      await loadItems()
    } catch (testError) {
      setError(
        testError instanceof Error
          ? testError.message
          : "No se pudo conectar con el MikroTik."
      )
    } finally {
      setTestingId(null)
    }
  }

  const helpText = useMemo(
    () =>
      "El usuario debe tener permisos suficientes para las operaciones que Bespoke vaya a realizar. En esta fase solo se requiere lectura (identity, resource e interfaces).",
    []
  )

  if (!isAuthReady) {
    return (
      <div className="rounded-xl border bg-muted/20 px-4 py-16 text-center text-sm text-muted-foreground">
        Verificando permisos...
      </div>
    )
  }

  if (!canManage) {
    return (
      <div className="rounded-xl border bg-muted/20 px-6 py-16 text-center">
        <p className="text-sm font-medium">Acceso restringido</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Configuracion no esta habilitada para su Area.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/configuracion">Volver a Configuracion</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Routers MikroTik</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Integracion RouterOS REST por empresa. Las credenciales se guardan cifradas y nunca se muestran.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          + Agregar MikroTik
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {testMessage ? (
        <pre className="whitespace-pre-wrap rounded-lg border bg-muted/20 px-4 py-3 text-sm" role="status">
          {testMessage}
        </pre>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando routers MikroTik…</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            Todavia no hay routers MikroTik registrados para esta empresa.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{item.name}</CardTitle>
                <CardDescription>
                  Host: {item.host}:{item.port}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>Protocolo: {protocolLabel(item.protocol)}</p>
                <p className="flex items-center gap-2">
                  Estado: <StatusDot status={item.lastConnectionStatus} /> {statusLabel(item)}
                </p>
                <p>Ultima comprobacion: {formatCheckedAt(item.lastConnectionAt)}</p>
                {item.lastConnectionStatus === "error" && item.lastConnectionError ? (
                  <p className="text-destructive">{item.lastConnectionError}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={testingId === item.id}
                    onClick={() => void handleTest(item)}
                  >
                    {testingId === item.id ? "Probando…" : "Probar conexion"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setViewItem(item)}>
                    Ver
                  </Button>
                  <Button type="button" variant="outline" onClick={() => openEdit(item)}>
                    Editar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar MikroTik" : "Agregar MikroTik"}</DialogTitle>
            <DialogDescription>{helpText}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mikrotik-name">Nombre</Label>
              <Input
                id="mikrotik-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mikrotik-host">Host/IP</Label>
              <Input
                id="mikrotik-host"
                value={form.host}
                onChange={(event) => setForm((current) => ({ ...current, host: event.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mikrotik-port">Puerto</Label>
                <Input
                  id="mikrotik-port"
                  value={form.port}
                  onChange={(event) => setForm((current) => ({ ...current, port: event.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Protocolo</Label>
                <Select
                  value={form.protocol}
                  onValueChange={(value) => {
                    const protocol = value as MikrotikProtocol
                    setForm((current) => ({
                      ...current,
                      protocol,
                      port: protocol === "https-rest" ? "443" : current.port,
                    }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="https-rest">HTTPS / REST</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="api-ssl">API-SSL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mikrotik-username">Usuario</Label>
              <Input
                id="mikrotik-username"
                value={form.username}
                autoComplete="off"
                onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mikrotik-password">Contrasena</Label>
              <Input
                id="mikrotik-password"
                type="password"
                value={form.password}
                autoComplete="new-password"
                placeholder={editing ? "Dejar vacio para conservar" : ""}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) =>
                  setForm((current) => ({ ...current, enabled: event.target.checked }))
                }
              />
              Habilitado
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={isSaving} onClick={() => void handleSave()}>
              {isSaving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(viewItem)} onOpenChange={(open) => !open && setViewItem(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{viewItem?.name ?? "MikroTik"}</DialogTitle>
            <DialogDescription>Informacion basica del router. Las credenciales no se muestran.</DialogDescription>
          </DialogHeader>
          {viewItem ? (
            <div className="space-y-2 text-sm">
              <p>Host: {viewItem.host}:{viewItem.port}</p>
              <p>Protocolo: {protocolLabel(viewItem.protocol)}</p>
              <p>Usuario: {viewItem.username}</p>
              <p className="flex items-center gap-2">
                Estado: <StatusDot status={viewItem.lastConnectionStatus} /> {statusLabel(viewItem)}
              </p>
              <p>Ultima comprobacion: {formatCheckedAt(viewItem.lastConnectionAt)}</p>
              {viewItem.lastRouterIdentity ? (
                <>
                  <p>Router: {viewItem.lastRouterIdentity.identity}</p>
                  <p>RouterOS: {viewItem.lastRouterIdentity.version}</p>
                  <p>Uptime: {viewItem.lastRouterIdentity.uptime ?? "—"}</p>
                  <p>CPU: {viewItem.lastRouterIdentity.cpuLoad ?? "—"}</p>
                  <p>
                    Memoria: {formatBytes(viewItem.lastRouterIdentity.freeMemory)} /{" "}
                    {formatBytes(viewItem.lastRouterIdentity.totalMemory)}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">Todavia no hay una lectura del router.</p>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
