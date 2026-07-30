"use client"

import { useEffect, useMemo, useState } from "react"

import { useAuth } from "@/components/auth/auth-provider"
import { CommercialDrawerFooter } from "@/components/gestion-comercial/commercial-drawer-footer"
import { CommercialSolicitudFormFields } from "@/components/gestion-comercial/commercial-solicitud-form-fields"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { resolveCommercialActorEmployeeId } from "@/lib/commercial/module-access"
import {
  createCommercialSolicitudBrowser,
  updateCommercialSolicitudBrowser,
} from "@/lib/supabase/commercial-solicitudes.browser"
import { listCommercialSolicitudTypesBrowser } from "@/lib/supabase/commercial-solicitud-types.browser"
import type {
  CommercialSolicitud,
  CommercialSolicitudFormValues,
  CommercialSolicitudType,
} from "@/lib/types/commercial-solicitudes"
import { emptyCommercialSolicitudFormValues } from "@/lib/types/commercial-solicitudes"

const FORM_ID = "commercial-solicitud-form"

type CommercialSolicitudDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string | null
  opportunityId: string
  solicitud?: CommercialSolicitud | null
  onSaved: (solicitud: CommercialSolicitud) => void
}

export function CommercialSolicitudDrawer({
  open,
  onOpenChange,
  companyId,
  opportunityId,
  solicitud = null,
  onSaved,
}: CommercialSolicitudDrawerProps) {
  const { sessionUser } = useAuth()
  const isEdit = Boolean(solicitud)
  const [values, setValues] = useState<CommercialSolicitudFormValues>(
    emptyCommercialSolicitudFormValues()
  )
  const [types, setTypes] = useState<CommercialSolicitudType[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const actorEmployeeId = useMemo(
    () =>
      sessionUser ? resolveCommercialActorEmployeeId(sessionUser) : null,
    [sessionUser]
  )

  const responsibleLabel = useMemo(() => {
    if (isEdit) {
      return solicitud?.responsibleEmployeeName?.trim() || "—"
    }
    if (!sessionUser) return "Usuario autenticado"
    return (
      sessionUser.displayName?.trim() ||
      sessionUser.email ||
      "Usuario autenticado"
    )
  }, [isEdit, sessionUser, solicitud?.responsibleEmployeeName])

  const fechaLabel = useMemo(() => {
    const value = isEdit && solicitud ? new Date(solicitud.createdAt) : new Date()
    try {
      return new Intl.DateTimeFormat("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(value)
    } catch {
      return "—"
    }
  }, [isEdit, solicitud])

  useEffect(() => {
    if (!open || !companyId) return
    let cancelled = false
    void listCommercialSolicitudTypesBrowser(companyId, {
      activeOnly: true,
      ensureDefaults: true,
    }).then((result) => {
      if (cancelled) return
      setTypes(result.data ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [open, companyId])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      if (solicitud) {
        setValues({
          requestTypeId: solicitud.requestTypeId,
          productPlan: solicitud.productPlan,
          priority: solicitud.priority,
          observations: solicitud.observations,
        })
      } else {
        setValues(emptyCommercialSolicitudFormValues())
      }
      setError(null)
      setIsSubmitting(false)
    })
    return () => {
      cancelled = true
    }
  }, [open, solicitud])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!companyId) {
      setError("Empresa no resuelta.")
      return
    }
    if (!values.requestTypeId) {
      setError("Seleccioná el tipo de solicitud.")
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      if (isEdit && solicitud) {
        const result = await updateCommercialSolicitudBrowser(
          companyId,
          solicitud.id,
          {
            requestTypeId: values.requestTypeId,
            productPlan: values.productPlan,
            priority: values.priority,
            observations: values.observations,
          },
          { employeeId: actorEmployeeId }
        )
        if (result.error || !result.data) {
          setError(result.error?.message ?? "No se pudo actualizar la solicitud.")
          return
        }
        onSaved(result.data)
        onOpenChange(false)
        return
      }

      const result = await createCommercialSolicitudBrowser(
        companyId,
        {
          opportunityId,
          requestTypeId: values.requestTypeId,
          productPlan: values.productPlan,
          priority: values.priority,
          observations: values.observations,
        },
        { employeeId: actorEmployeeId }
      )
      if (result.error || !result.data) {
        setError(result.error?.message ?? "No se pudo crear la solicitud.")
        return
      }
      onSaved(result.data)
      onOpenChange(false)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar la solicitud."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
        showCloseButton
      >
        <SheetHeader className="shrink-0 border-b">
          <SheetTitle>
            {isEdit ? "Editar Solicitud" : "Nueva Solicitud"}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Actualizá los datos del pedido del cliente."
              : "Registrá un pedido concreto del cliente."}
          </SheetDescription>
        </SheetHeader>

        <form
          id={FORM_ID}
          className="flex flex-1 flex-col gap-4 overflow-y-auto p-4"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <CommercialSolicitudFormFields
            values={values}
            onChange={setValues}
            types={types}
            disabled={isSubmitting}
            meta={
              <div className="grid gap-3 rounded-lg border bg-muted/20 px-3 py-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Fecha
                  </p>
                  <p className="text-sm">{fechaLabel}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Comercial responsable
                  </p>
                  <p className="text-sm">{responsibleLabel}</p>
                </div>
              </div>
            }
          />

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </form>

        <CommercialDrawerFooter
          formId={FORM_ID}
          isSubmitting={isSubmitting}
          onCancel={() => onOpenChange(false)}
          submitLabel={isEdit ? "Guardar cambios" : "Crear Solicitud"}
        />
      </SheetContent>
    </Sheet>
  )
}
