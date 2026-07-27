"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { CommercialPersonType } from "@/lib/commercial/catalogs"
import type { CommercialPersonFormValue } from "@/lib/commercial/display"
import type { CommercialNewOpportunityPersonInput } from "@/lib/commercial/create-opportunity"
import { cn } from "@/lib/utils"

export type CommercialPersonFormProps = {
  value: CommercialPersonFormValue | CommercialNewOpportunityPersonInput
  onChange: (
    next: CommercialPersonFormValue | CommercialNewOpportunityPersonInput
  ) => void
  disabled?: boolean
  autoFocusName?: boolean
  existingProspectNotice?: string | null
  /** When true, shows document/address/notes fields for the dossier editor. */
  showExtendedFields?: boolean
  onAdvanceField?: (event: React.KeyboardEvent<HTMLInputElement>) => void
}

function hasExtendedFields(
  value: CommercialPersonFormValue | CommercialNewOpportunityPersonInput
): value is CommercialPersonFormValue {
  return "documentNumber" in value
}

export function CommercialPersonForm({
  value,
  onChange,
  disabled = false,
  autoFocusName = false,
  existingProspectNotice = null,
  showExtendedFields = false,
  onAdvanceField,
}: CommercialPersonFormProps) {
  function patch(
    partial: Partial<CommercialPersonFormValue | CommercialNewOpportunityPersonInput>
  ) {
    onChange({ ...value, ...partial } as typeof value)
  }

  function setPersonType(personType: CommercialPersonType) {
    patch({ personType })
  }

  const extended = showExtendedFields && hasExtendedFields(value)

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

      {extended ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="commercial-person-document">Documento</Label>
            <Input
              id="commercial-person-document"
              value={value.documentNumber}
              onChange={(event) =>
                patch({ documentNumber: event.target.value })
              }
              onKeyDown={onAdvanceField}
              disabled={disabled}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="commercial-person-tax-id">CUIT</Label>
            <Input
              id="commercial-person-tax-id"
              value={value.taxId}
              onChange={(event) => patch({ taxId: event.target.value })}
              onKeyDown={onAdvanceField}
              disabled={disabled}
            />
          </div>
        </div>
      ) : null}

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

      {extended ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="commercial-person-address">Dirección</Label>
            <Input
              id="commercial-person-address"
              value={value.address}
              onChange={(event) => patch({ address: event.target.value })}
              onKeyDown={onAdvanceField}
              disabled={disabled}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="commercial-person-city">Ciudad</Label>
              <Input
                id="commercial-person-city"
                value={value.city}
                onChange={(event) => patch({ city: event.target.value })}
                onKeyDown={onAdvanceField}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commercial-person-province">Provincia</Label>
              <Input
                id="commercial-person-province"
                value={value.province}
                onChange={(event) => patch({ province: event.target.value })}
                onKeyDown={onAdvanceField}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commercial-person-postal">Código Postal</Label>
              <Input
                id="commercial-person-postal"
                value={value.postalCode}
                onChange={(event) => patch({ postalCode: event.target.value })}
                onKeyDown={onAdvanceField}
                disabled={disabled}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="commercial-person-notes">Notas</Label>
            <Textarea
              id="commercial-person-notes"
              value={value.notes}
              onChange={(event) => patch({ notes: event.target.value })}
              rows={3}
              disabled={disabled}
            />
          </div>
        </>
      ) : null}

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
