"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import {
  buildConsultationOtCreateHref,
  buildConsultationOtCreatePrefill,
  storeConsultationOtCreatePrefill,
} from "@/lib/customer-atenciones/consultation-ot-create"
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

/**
 * RC 3.2.6 — origin point for OT creation (reuses /tareas Nueva OT).
 * Manual ID linking removed.
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pendiente de generar OT</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {linkedTaskId ? (
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <p>
              OT vinculada:{" "}
              <Link
                href={`/tareas/${linkedTaskId}`}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                {linkedTaskCode ?? linkedTaskId}
              </Link>
            </p>
            {otLinkedAt ? (
              <p className="text-xs text-muted-foreground">
                Vinculada el {new Date(otLinkedAt).toLocaleString("es-AR")}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Creá la Orden de Trabajo desde el formulario habitual. Al
              guardarla se vinculará automáticamente a esta consulta.
            </p>
            <Button type="button" onClick={handleCreateWorkOrder}>
              Crear Orden de Trabajo
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
