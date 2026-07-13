"use client"

import { useEffect, useState } from "react"

import { useAtencionCliente } from "@/components/atencion-cliente/atencion-cliente-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type OtLinkBlockProps = {
  atencionId: string
  linkedTaskId?: string | null
  linkedTaskCode?: string | null
  otLinkedAt?: string | null
}

export function OtLinkBlock({
  atencionId,
  linkedTaskId,
  linkedTaskCode,
  otLinkedAt,
}: OtLinkBlockProps) {
  const { linkConsultationOt } = useAtencionCliente()
  const [taskId, setTaskId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setError(null)
  }, [linkedTaskId])

  async function handleLink() {
    setError(null)
    const trimmed = taskId.trim()
    if (!trimmed) {
      setError("Indicá el ID de la OT a vincular.")
      return
    }

    setIsSaving(true)
    try {
      const result = await linkConsultationOt(atencionId, trimmed)
      if (!result.success) {
        setError(result.message)
        return
      }
      setTaskId("")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pendiente de generar OT</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          La gestión está lista para crear la Orden de Trabajo. Vinculá la OT
          generada para conservar trazabilidad sin cerrar la consulta.
        </p>

        {linkedTaskId ? (
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <p>
              OT vinculada:{" "}
              <span className="font-medium text-foreground">
                {linkedTaskCode ?? linkedTaskId}
              </span>
            </p>
            {otLinkedAt ? (
              <p className="text-xs text-muted-foreground">
                Vinculada el {new Date(otLinkedAt).toLocaleString("es-AR")}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="ot-task-id">ID de la OT</Label>
            <Input
              id="ot-task-id"
              value={taskId}
              onChange={(event) => setTaskId(event.target.value)}
              placeholder="UUID de la orden de trabajo"
            />
            <Button onClick={handleLink} disabled={isSaving}>
              {isSaving ? "Vinculando…" : "Vincular OT"}
            </Button>
          </div>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  )
}
