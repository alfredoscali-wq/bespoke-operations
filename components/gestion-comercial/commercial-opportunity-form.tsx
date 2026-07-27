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
  COMMERCIAL_PRIORITY_CODES,
  COMMERCIAL_PRIORITY_LABELS,
  COMMERCIAL_SOURCE_CODES,
  COMMERCIAL_SOURCE_LABELS,
  COMMERCIAL_STATUS_CODES,
  COMMERCIAL_STATUS_LABELS,
} from "@/lib/commercial/catalogs"
import type { CommercialOpportunityFormValue } from "@/lib/commercial/display"
import type { CommercialNewOpportunityInput } from "@/lib/commercial/create-opportunity"

export type CommercialOpportunityResponsibleOption = {
  id: string
  label: string
}

export type CommercialOpportunityFormProps = {
  value: CommercialOpportunityFormValue | CommercialNewOpportunityInput
  onChange: (
    next: CommercialOpportunityFormValue | CommercialNewOpportunityInput
  ) => void
  responsibleOptions: CommercialOpportunityResponsibleOption[]
  disabled?: boolean
  /** When true, shows status/amount/probability/close date/lost reason. */
  showExtendedFields?: boolean
  onAdvanceField?: (event: React.KeyboardEvent<HTMLInputElement>) => void
}

function hasExtendedFields(
  value: CommercialOpportunityFormValue | CommercialNewOpportunityInput
): value is CommercialOpportunityFormValue {
  return "status" in value
}

export function CommercialOpportunityForm({
  value,
  onChange,
  responsibleOptions,
  disabled = false,
  showExtendedFields = false,
  onAdvanceField,
}: CommercialOpportunityFormProps) {
  function patch(
    partial: Partial<
      CommercialOpportunityFormValue | CommercialNewOpportunityInput
    >
  ) {
    onChange({ ...value, ...partial } as typeof value)
  }

  const extended = showExtendedFields && hasExtendedFields(value)
  const observationsLabel = extended ? "Descripción" : "Observaciones"

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="commercial-opportunity-title">Título</Label>
        <Input
          id="commercial-opportunity-title"
          value={value.title}
          onChange={(event) => patch({ title: event.target.value })}
          onKeyDown={onAdvanceField}
          disabled={disabled}
          required
        />
      </div>

      {extended ? (
        <div className="space-y-2">
          <Label htmlFor="commercial-opportunity-status">Estado</Label>
          <Select
            value={value.status}
            onValueChange={(status) =>
              patch({
                status: status as CommercialOpportunityFormValue["status"],
              })
            }
            disabled={disabled}
          >
            <SelectTrigger id="commercial-opportunity-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMERCIAL_STATUS_CODES.map((code) => (
                <SelectItem key={code} value={code}>
                  {COMMERCIAL_STATUS_LABELS[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="commercial-opportunity-responsible">Responsable</Label>
        <Select
          value={value.assignedEmployeeId || undefined}
          onValueChange={(assignedEmployeeId) => patch({ assignedEmployeeId })}
          disabled={disabled}
        >
          <SelectTrigger id="commercial-opportunity-responsible">
            <SelectValue placeholder="Seleccionar responsable" />
          </SelectTrigger>
          <SelectContent>
            {responsibleOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="commercial-opportunity-source">Origen</Label>
          <Select
            value={value.source}
            onValueChange={(source) =>
              patch({
                source: source as CommercialNewOpportunityInput["source"],
              })
            }
            disabled={disabled}
          >
            <SelectTrigger id="commercial-opportunity-source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMERCIAL_SOURCE_CODES.map((code) => (
                <SelectItem key={code} value={code}>
                  {COMMERCIAL_SOURCE_LABELS[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="commercial-opportunity-priority">Prioridad</Label>
          <Select
            value={value.priority}
            onValueChange={(priority) =>
              patch({
                priority: priority as CommercialNewOpportunityInput["priority"],
              })
            }
            disabled={disabled}
          >
            <SelectTrigger id="commercial-opportunity-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMERCIAL_PRIORITY_CODES.map((code) => (
                <SelectItem key={code} value={code}>
                  {COMMERCIAL_PRIORITY_LABELS[code]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {extended ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="commercial-opportunity-amount">Monto estimado</Label>
            <Input
              id="commercial-opportunity-amount"
              inputMode="decimal"
              value={value.estimatedAmount}
              onChange={(event) =>
                patch({ estimatedAmount: event.target.value })
              }
              onKeyDown={onAdvanceField}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="commercial-opportunity-probability">
              Probabilidad (%)
            </Label>
            <Input
              id="commercial-opportunity-probability"
              inputMode="numeric"
              value={value.probability}
              onChange={(event) => patch({ probability: event.target.value })}
              onKeyDown={onAdvanceField}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="commercial-opportunity-close-date">
              Fecha estimada de cierre
            </Label>
            <Input
              id="commercial-opportunity-close-date"
              type="date"
              value={value.expectedCloseDate}
              onChange={(event) =>
                patch({ expectedCloseDate: event.target.value })
              }
              onKeyDown={onAdvanceField}
              disabled={disabled}
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="commercial-opportunity-observations">
          {observationsLabel}
        </Label>
        <Textarea
          id="commercial-opportunity-observations"
          value={value.observations}
          onChange={(event) => patch({ observations: event.target.value })}
          rows={3}
          disabled={disabled}
        />
      </div>

      {extended ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="commercial-opportunity-latitude">Latitud</Label>
            <Input
              id="commercial-opportunity-latitude"
              inputMode="decimal"
              value={value.latitude == null ? "" : String(value.latitude)}
              onChange={(event) => {
                const raw = event.target.value.trim()
                patch({
                  latitude: raw === "" ? null : Number(raw),
                  locationSource:
                    raw === "" && value.longitude == null
                      ? null
                      : value.locationSource ?? "manual",
                })
              }}
              onKeyDown={onAdvanceField}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="commercial-opportunity-longitude">Longitud</Label>
            <Input
              id="commercial-opportunity-longitude"
              inputMode="decimal"
              value={value.longitude == null ? "" : String(value.longitude)}
              onChange={(event) => {
                const raw = event.target.value.trim()
                patch({
                  longitude: raw === "" ? null : Number(raw),
                  locationSource:
                    raw === "" && value.latitude == null
                      ? null
                      : value.locationSource ?? "manual",
                })
              }}
              onKeyDown={onAdvanceField}
              disabled={disabled}
            />
          </div>
        </div>
      ) : null}

      {extended && value.status === "perdida" ? (
        <div className="space-y-2">
          <Label htmlFor="commercial-opportunity-lost-reason">
            Motivo de pérdida
          </Label>
          <Textarea
            id="commercial-opportunity-lost-reason"
            value={value.lostReason}
            onChange={(event) => patch({ lostReason: event.target.value })}
            rows={2}
            disabled={disabled}
          />
        </div>
      ) : null}
    </div>
  )
}
