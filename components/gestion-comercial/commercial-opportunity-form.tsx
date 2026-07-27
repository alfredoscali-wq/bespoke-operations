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
} from "@/lib/commercial/catalogs"
import type { CommercialNewOpportunityInput } from "@/lib/commercial/create-opportunity"

export type CommercialOpportunityResponsibleOption = {
  id: string
  label: string
}

export type CommercialOpportunityFormProps = {
  value: CommercialNewOpportunityInput
  onChange: (next: CommercialNewOpportunityInput) => void
  responsibleOptions: CommercialOpportunityResponsibleOption[]
  disabled?: boolean
  onAdvanceField?: (event: React.KeyboardEvent<HTMLInputElement>) => void
}

export function CommercialOpportunityForm({
  value,
  onChange,
  responsibleOptions,
  disabled = false,
  onAdvanceField,
}: CommercialOpportunityFormProps) {
  function patch(partial: Partial<CommercialNewOpportunityInput>) {
    onChange({ ...value, ...partial })
  }

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

      <div className="space-y-2">
        <Label htmlFor="commercial-opportunity-observations">Observaciones</Label>
        <Textarea
          id="commercial-opportunity-observations"
          value={value.observations}
          onChange={(event) => patch({ observations: event.target.value })}
          rows={3}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
