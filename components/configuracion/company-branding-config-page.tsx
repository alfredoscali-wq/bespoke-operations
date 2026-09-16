"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

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
import { canManageCompanyBranding } from "@/lib/company-branding/access"
import { tenantChromeStyle } from "@/lib/company-branding/theme"
import type { CompanyBranding } from "@/lib/company-branding/types"

export function CompanyBrandingConfigPage() {
  const router = useRouter()
  const { sessionUser, isAuthReady } = useAuth()
  const canManage = canManageCompanyBranding(sessionUser)
  const [branding, setBranding] = useState<CompanyBranding | null>(null)
  const [primaryColor, setPrimaryColor] = useState("")
  const [secondaryColor, setSecondaryColor] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadBranding = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/company-branding")
      const body = (await response.json()) as {
        success?: boolean
        branding?: CompanyBranding | null
        message?: string
      }
      if (!response.ok || !body.success) {
        throw new Error(body.message ?? "No se pudo cargar la identidad.")
      }
      const current = body.branding ?? null
      setBranding(current)
      setPrimaryColor(current?.primaryColor ?? "")
      setSecondaryColor(current?.secondaryColor ?? "")
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "No se pudo cargar la identidad."
      )
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isAuthReady || !canManage) {
      return
    }
    void loadBranding()
  }, [canManage, isAuthReady, loadBranding])

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    setIsSaving(true)
    try {
      const response = await fetch("/api/company-branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryColor: primaryColor.trim() || null,
          secondaryColor: secondaryColor.trim() || null,
        }),
      })
      const body = (await response.json()) as {
        success?: boolean
        branding?: CompanyBranding
        message?: string
      }
      if (!response.ok || !body.success || !body.branding) {
        throw new Error(body.message ?? "No se pudo guardar.")
      }
      setBranding(body.branding)
      setPrimaryColor(body.branding.primaryColor ?? "")
      setSecondaryColor(body.branding.secondaryColor ?? "")
      setMessage("Identidad de empresa guardada.")
      router.refresh()
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "No se pudo guardar."
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleLogo(file: File | undefined) {
    if (!file) return
    setError(null)
    setMessage(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.set("file", file)
      const response = await fetch("/api/company-branding/logo", {
        method: "POST",
        body: formData,
      })
      const body = (await response.json()) as {
        success?: boolean
        branding?: CompanyBranding
        message?: string
      }
      if (!response.ok || !body.success || !body.branding) {
        throw new Error(body.message ?? "No se pudo cargar el logo.")
      }
      setBranding(body.branding)
      setMessage("Logo actualizado.")
      router.refresh()
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "No se pudo cargar el logo."
      )
    } finally {
      setUploading(false)
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
          Solo un administrador puede configurar la identidad de empresa.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/configuracion">Volver a Configuración</Link>
        </Button>
      </div>
    )
  }

  const previewStyle = tenantChromeStyle({
    primaryColor: primaryColor || branding?.primaryColor,
    secondaryColor: secondaryColor || branding?.secondaryColor,
  })
  const previewLogo = branding?.logoUrl

  return (
    <form className="space-y-6" onSubmit={(event) => void handleSave(event)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Identidad de empresa
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Logo y colores del tenant. Operations autenticado y Mobile bootstrap
          usan la misma fuente.
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Marca visual</CardTitle>
            <CardDescription>
              No modifica el nombre interno de la empresa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="company-branding-logo">Logo</Label>
              <Input
                id="company-branding-logo"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={isLoading || uploading || isSaving}
                onChange={(event) => {
                  void handleLogo(event.target.files?.[0])
                  event.target.value = ""
                }}
              />
              {previewLogo ? (
                <img
                  src={previewLogo}
                  alt="Logo actual de la empresa"
                  className="mt-2 h-14 w-auto max-w-full object-contain"
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Todavía no hay logo cargado. Mientras tanto el menú usa el
                  logo de instancia.
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company-branding-primary">Color primario</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="company-branding-primary"
                    type="color"
                    className="h-9 w-12 cursor-pointer p-1"
                    value={primaryColor || "#000000"}
                    disabled={isLoading || isSaving}
                    onChange={(event) => setPrimaryColor(event.target.value)}
                  />
                  <Input
                    value={primaryColor}
                    placeholder="#RRGGBB"
                    disabled={isLoading || isSaving}
                    onChange={(event) => setPrimaryColor(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-branding-secondary">
                  Color secundario
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="company-branding-secondary"
                    type="color"
                    className="h-9 w-12 cursor-pointer p-1"
                    value={secondaryColor || "#000000"}
                    disabled={isLoading || isSaving}
                    onChange={(event) => setSecondaryColor(event.target.value)}
                  />
                  <Input
                    value={secondaryColor}
                    placeholder="#RRGGBB"
                    disabled={isLoading || isSaving}
                    onChange={(event) => setSecondaryColor(event.target.value)}
                  />
                </div>
              </div>
            </div>
            <Button type="submit" disabled={isLoading || isSaving || uploading}>
              {isSaving ? "Guardando…" : "Guardar identidad"}
            </Button>
          </CardContent>
        </Card>

        <Card style={previewStyle}>
          <CardHeader>
            <CardTitle className="text-base">Vista previa</CardTitle>
            <CardDescription>
              Botón principal y acento del tenant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex h-16 items-center justify-center rounded-lg border bg-background">
              {previewLogo ? (
                <img
                  src={previewLogo}
                  alt=""
                  className="h-10 w-auto max-w-[180px] object-contain"
                />
              ) : (
                <span className="text-xs text-muted-foreground">Sin logo</span>
              )}
            </div>
            <Button type="button" className="w-full">
              Acción principal
            </Button>
            <div
              className="h-2 rounded-full"
              style={{
                background:
                  secondaryColor || branding?.secondaryColor || "var(--border)",
              }}
            />
          </CardContent>
        </Card>
      </div>
    </form>
  )
}
