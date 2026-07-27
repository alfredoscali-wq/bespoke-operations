"use client"

import {
  CommercialOpportunityForm,
  type CommercialOpportunityResponsibleOption,
} from "@/components/gestion-comercial/commercial-opportunity-form"
import type { CommercialNewOpportunityInput } from "@/lib/commercial/create-opportunity"

type CommercialOpportunitySectionProps = {
  value: CommercialNewOpportunityInput
  onChange: (next: CommercialNewOpportunityInput) => void
  responsibleOptions: CommercialOpportunityResponsibleOption[]
  disabled?: boolean
  onAdvanceField?: (event: React.KeyboardEvent<HTMLInputElement>) => void
}

export function CommercialOpportunitySection({
  value,
  onChange,
  responsibleOptions,
  disabled,
  onAdvanceField,
}: CommercialOpportunitySectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Oportunidad
      </h2>
      <CommercialOpportunityForm
        value={value}
        onChange={onChange}
        responsibleOptions={responsibleOptions}
        disabled={disabled}
        onAdvanceField={onAdvanceField}
      />
    </section>
  )
}
