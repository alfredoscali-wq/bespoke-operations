"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import {
  buildConsultationOtCreateHref,
  buildConsultationOtCreatePrefill,
  storeConsultationOtCreatePrefill,
} from "@/lib/customer-atenciones/consultation-ot-create"
import { createClient } from "@/lib/supabase/client"
import { TASK_STATUS_LABELS } from "@/lib/tasks/constants"
import type { TaskStatus } from "@/lib/types/tasks"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type OtLinkBlockProps = {
  atencionId: string
  customerId: string
  motivoLabel: string
  initialObservations?: string | null
  technicalHistory?: string | null
  linkedTaskId?: string | null
  linkedTaskCode?: string | null
  otLinkedAt?: string | null
}

function isTaskStatus(value: string): value is TaskStatus {
  return value in TASK_STATUS_LABELS
}

/**
 * RC 3.2.6 / 3.2.7 — create OT while pending; after link show closed Atención card.
 */
export function OtLinkBlock({
  atencionId,
  customerId,
  motivoLabel,
  initialObservations,
  technicalHistory,
  linkedTaskId,
  linkedTaskCode,
  otLinkedAt,
}: OtLinkBlockProps) {
  const router = useRouter()
  const [taskStatusLabel, setTaskStatusLabel] = useState<string | null>(null)

  useEffect(() => {
    if (!linkedTaskId) {
      setTaskStatusLabel(null)
      return
    }

    let cancelled = false
    const supabase = createClient()

    void (async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("status")
        .eq("id", linkedTaskId)
        .maybeSingle()

      if (cancelled || error || !data?.status) {
        return
      }

      const status = String(data.status)
      setTaskStatusLabel(
        isTaskStatus(status) ? TASK_STATUS_LABELS[status] : status
      )
    })()

    return () => {
      cancelled = true
    }
  }, [linkedTaskId])

  function handleCreateWorkOrder() {
    const prefill = buildConsultationOtCreatePrefill({
      atencionId,
      customerId,
      motivoLabel,
      initialObservations,
      technicalHistory,
    })
    storeConsultationOtCreatePrefill(prefill)
    router.push(
      buildConsultationOtCreateHref({
        atencionId,
        customerId,
      })
    )
  }

  if (linkedTaskId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Orden de Trabajo vinculada</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            ✓ Orden de Trabajo creada correctamente
          </p>
          <dl className="space-y-1.5 text-sm">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">Código OT</dt>
              <dd className="font-medium">
                {linkedTaskCode ?? linkedTaskId}
              </dd>
            </div>
            {otLinkedAt ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground">Fecha de creación</dt>
                <dd className="font-medium">
                  {new Date(otLinkedAt).toLocaleString("es-AR")}
                </dd>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">Estado actual de la OT</dt>
              <dd className="font-medium">{taskStatusLabel ?? "—"}</dd>
            </div>
          </dl>
          <Button type="button" asChild>
            <Link href={`/tareas/${linkedTaskId}`}>
              Abrir Orden de Trabajo
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pendiente de generar OT</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Creá la Orden de Trabajo desde el formulario habitual. Al
          guardarla se vinculará automáticamente a esta consulta.
        </p>
        <Button type="button" onClick={handleCreateWorkOrder}>
          Crear Orden de Trabajo
        </Button>
      </CardContent>
    </Card>
  )
}
