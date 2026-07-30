"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  COMMERCIAL_SOLICITUD_PRIORITY_CODES,
  COMMERCIAL_SOLICITUD_PRIORITY_LABELS,
  type CommercialSolicitudPriorityCode,
} from "@/lib/commercial/solicitud-catalogs"
import type {
  CommercialSolicitudFormValues,
  CommercialSolicitudType,
} from "@/lib/types/commercial-solicitudes"
import { cn } from "@/lib/utils"

type CommercialSolicitudFormFieldsProps = {
  values: CommercialSolicitudFormValues
  onChange: (next: CommercialSolicitudFormValues) => void
  types: CommercialSolicitudType[]
  disabled?: boolean
  idPrefix?: string
  className?: string
  /** Read-only metadata row (fecha / responsable) for the full drawer. */
  meta?: React.ReactNode
}

export function CommercialSolicitudFormFields({
  values,
  onChange,
  types,
  disabled = false,
  idPrefix = "solicitud",
  className,
  meta,
}: CommercialSolicitudFormFieldsProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-type`}>Tipo de Solicitud *</Label>
        <Select
          value={values.requestTypeId || undefined}
          onValueChange={(value) =>
            onChange({ ...values, requestTypeId: value })
          }
          disabled={disabled}
        >
          <SelectTrigger id={`${idPrefix}-type`}>
            <SelectValue placeholder="Seleccionar tipo" />
          </SelectTrigger>
          <SelectContent>
            {types.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-product`}>
          Producto / Servicio solicitado
        </Label>
        <Input
          id={`${idPrefix}-product`}
          value={values.productPlan}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...values, productPlan: event.target.value })
          }
          placeholder="Ej: 300 Mb, TV HD, Triple Play"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-priority`}>Prioridad</Label>
        <Select
          value={values.priority}
          onValueChange={(value) =>
            onChange({
              ...values,
              priority: value as CommercialSolicitudPriorityCode,
            })
          }
          disabled={disabled}
        >
          <SelectTrigger id={`${idPrefix}-priority`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMMERCIAL_SOLICITUD_PRIORITY_CODES.map((code) => (
              <SelectItem key={code} value={code}>
                {COMMERCIAL_SOLICITUD_PRIORITY_LABELS[code]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-observations`}>Observaciones</Label>
        <Textarea
          id={`${idPrefix}-observations`}
          value={values.observations}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...values, observations: event.target.value })
          }
          rows={4}
          placeholder="Detalle adicional del pedido…"
        />
      </div>

      {meta}
    </div>
  )
}
