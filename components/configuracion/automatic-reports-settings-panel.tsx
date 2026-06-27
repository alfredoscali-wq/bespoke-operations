"use client"

import { useEffect, useState } from "react"
import { Mail, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { EntityActionFeedback } from "@/components/ui/entity-action-feedback"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { WEEKLY_REPORT_SEND_DAY_OPTIONS } from "@/lib/reports/automatic/config"

type SettingsDto = {
  id: string
  reportType: string
  enabled: boolean
  companyName: string
  recipientEmail: string
  sendDay: number
  sendTime: string
}

type SettingsResponse = {
  success: boolean
  settings?: SettingsDto
  message?: string
}

type TestSendResponse = {
  success: boolean
  result?: { message?: string; emailSent?: boolean; pdfGenerated?: boolean }
  message?: string
}

export function AutomaticReportsSettingsPanel() {
  const [settings, setSettings] = useState<SettingsDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [feedback, setFeedback] = useState<{
    variant: "success" | "error"
    message: string
  } | null>(null)

  useEffect(() => {
    void loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)

    try {
      const response = await fetch("/api/reports/automatic/settings")
      const payload = (await response.json()) as SettingsResponse

      if (payload.success && payload.settings) {
        setSettings(payload.settings)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!settings || saving) {
      return
    }

    setSaving(true)
    setFeedback(null)

    try {
      const response = await fetch("/api/reports/automatic/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: settings.enabled,
          companyName: settings.companyName,
          recipientEmail: settings.recipientEmail,
          sendDay: settings.sendDay,
          sendTime: settings.sendTime,
        }),
      })

      const payload = (await response.json()) as SettingsResponse

      if (!payload.success || !payload.settings) {
        throw new Error(payload.message ?? "No se pudo guardar la configuración.")
      }

      setSettings(payload.settings)
      setFeedback({
        variant: "success",
        message: "Configuración guardada correctamente.",
      })
    } catch (error) {
      setFeedback({
        variant: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo guardar la configuración.",
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleTestSend() {
    if (testing) {
      return
    }

    setTesting(true)
    setFeedback(null)

    try {
      const response = await fetch("/api/reports/automatic/settings/test-send", {
        method: "POST",
      })
      const payload = (await response.json()) as TestSendResponse

      if (!payload.result?.pdfGenerated && !payload.success) {
        throw new Error(payload.message ?? payload.result?.message ?? "No se pudo probar el envío.")
      }

      if (payload.result?.pdfGenerated && !payload.result.emailSent) {
        setFeedback({
          variant: "error",
          message:
            "No fue posible enviar el correo. El PDF fue generado correctamente.",
        })
      } else {
        setFeedback({
          variant: "success",
          message: payload.result?.message ?? "Envío de prueba realizado.",
        })
      }
    } catch (error) {
      setFeedback({
        variant: "error",
        message:
          error instanceof Error
            ? error.message
            : "No se pudo probar el envío.",
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reporte Semanal Ejecutivo</CardTitle>
          <CardDescription>
            Bespoke Weekly Report — envío programado y manual.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {loading || !settings ? (
            <div className="space-y-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-10 w-full max-w-md" />
              <Skeleton className="h-10 w-full max-w-md" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="weekly-report-enabled"
                  checked={settings.enabled}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, enabled: checked === true })
                  }
                />
                <Label htmlFor="weekly-report-enabled">Activado</Label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Empresa</Label>
                  <Input
                    id="company-name"
                    value={settings.companyName}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        companyName: event.target.value,
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recipient-email">Destinatario</Label>
                  <Input
                    id="recipient-email"
                    type="email"
                    value={settings.recipientEmail}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        recipientEmail: event.target.value,
                      })
                    }
                    placeholder="gerencia@empresa.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="send-day">Día</Label>
                  <Select
                    value={String(settings.sendDay)}
                    onValueChange={(value) =>
                      setSettings({ ...settings, sendDay: Number(value) })
                    }
                  >
                    <SelectTrigger id="send-day" className="w-full">
                      <SelectValue placeholder="Seleccionar día" />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKLY_REPORT_SEND_DAY_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={String(option.value)}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="send-time">Hora</Label>
                  <Input
                    id="send-time"
                    type="time"
                    value={settings.sendTime}
                    onChange={(event) =>
                      setSettings({ ...settings, sendTime: event.target.value })
                    }
                  />
                </div>
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={saving || loading || !settings}
            onClick={() => void handleSave()}
          >
            <Save className="size-4" />
            {saving ? "Guardando..." : "Guardar"}
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={testing || loading}
            onClick={() => void handleTestSend()}
          >
            <Mail className="size-4" />
            {testing ? "Enviando..." : "Probar envío"}
          </Button>
        </CardFooter>
      </Card>

      {feedback ? (
        <EntityActionFeedback variant={feedback.variant} message={feedback.message} />
      ) : null}
    </div>
  )
}
