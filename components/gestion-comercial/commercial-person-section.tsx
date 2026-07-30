"use client"

import { CommercialPersonForm } from "@/components/gestion-comercial/commercial-person-form"
import type { CommercialNewOpportunityPersonInput } from "@/lib/commercial/create-opportunity"

type CommercialPersonSectionProps = {
  value: CommercialNewOpportunityPersonInput
  onChange: (next: CommercialNewOpportunityPersonInput) => void
  disabled?: boolean
  autoFocusName?: boolean
  existingProspectNotice?: string | null
  onAdvanceField?: (event: React.KeyboardEvent<HTMLInputElement>) => void
}

export function CommercialPersonSection({
  value,
  onChange,
  disabled,
  autoFocusName,
  existingProspectNotice,
  onAdvanceField,
}: CommercialPersonSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Cliente
      </h2>
      <CommercialPersonForm
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoFocusName={autoFocusName}
        existingProspectNotice={existingProspectNotice}
        onAdvanceField={onAdvanceField}
        showLocationFields
      />
    </section>
  )
}
