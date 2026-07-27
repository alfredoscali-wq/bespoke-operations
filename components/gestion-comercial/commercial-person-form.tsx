"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CommercialPersonType } from "@/lib/commercial/catalogs"
import type { CommercialNewOpportunityPersonInput } from "@/lib/commercial/create-opportunity"
import { cn } from "@/lib/utils"

export type CommercialPersonFormProps = {
  value: CommercialNewOpportunityPersonInput
  onChange: (next: CommercialNewOpportunityPersonInput) => void
  disabled?: boolean
  autoFocusName?: boolean
  existingProspectNotice?: string | null
  onAdvanceField?: (event: React.KeyboardEvent<HTMLInputElement>) => void
}

export function CommercialPersonForm({
  value,
  onChange,
  disabled = false,
  autoFocusName = false,
  existingProspectNotice = null,
  onAdvanceField,
}: CommercialPersonFormProps) {
  function patch(partial: Partial<CommercialNewOpportunityPersonInput>) {
    onChange({ ...value, ...partial })
  }

  function setPersonType(personType: CommercialPersonType) {
    patch({ personType })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="commercial-person-type"
              checked={value.personType === "individual"}
              onChange={() => setPersonType("individual")}
              disabled={disabled}
            />
            Persona
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="commercial-person-type"
              checked={value.personType === "company"}
              onChange={() => setPersonType("company")}
              disabled={disabled}
            />
            Empresa
          </label>
        </div>
      </div>

      {value.personType === "individual" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="commercial-person-first-name">Nombre</Label>
            <Input
              id="commercial-person-first-name"
              value={value.firstName}
              onChange={(event) => patch({ firstName: event.target.value })}
              onKeyDown={onAdvanceField}
              disabled={disabled}
              autoFocus={autoFocusName}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="commercial-person-last-name">Apellido</Label>
            <Input
              id="commercial-person-last-name"
              value={value.lastName}
              onChange={(event) => patch({ lastName: event.target.value })}
              onKeyDown={onAdvanceField}
              disabled={disabled}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="commercial-person-company-name">Razón Social</Label>
          <Input
            id="commercial-person-company-name"
            value={value.companyName}
            onChange={(event) => patch({ companyName: event.target.value })}
            onKeyDown={onAdvanceField}
            disabled={disabled}
            autoFocus={autoFocusName}
            required
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="commercial-person-phone">Teléfono</Label>
          <Input
            id="commercial-person-phone"
            value={value.phone}
            onChange={(event) => patch({ phone: event.target.value })}
            onKeyDown={onAdvanceField}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="commercial-person-mobile">Celular</Label>
          <Input
            id="commercial-person-mobile"
            value={value.mobile}
            onChange={(event) => patch({ mobile: event.target.value })}
            onKeyDown={onAdvanceField}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="commercial-person-email">Email</Label>
        <Input
          id="commercial-person-email"
          type="email"
          value={value.email}
          onChange={(event) => patch({ email: event.target.value })}
          onKeyDown={onAdvanceField}
          disabled={disabled}
        />
      </div>

      {existingProspectNotice ? (
        <p
          className={cn(
            "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          )}
          role="status"
        >
          {existingProspectNotice}
        </p>
      ) : null}
    </div>
  )
}
