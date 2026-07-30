"use client"

import { CommercialEtiquetaBadge } from "@/components/gestion-comercial/commercial-etiqueta-badge"
import { CommercialInfoRow } from "@/components/gestion-comercial/commercial-info-row"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { resolveCommercialClientDisplayName } from "@/lib/commercial/display"
import type {
  CommercialOpportunity,
  CommercialPerson,
} from "@/lib/types/commercial"
import { cn } from "@/lib/utils"

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}

function PhoneLink({ value }: { value: string }) {
  return (
    <a
      href={`tel:${value.replace(/\s+/g, "")}`}
      className="font-medium text-primary hover:underline"
    >
      {value}
    </a>
  )
}

type CommercialClientCardProps = {
  person: CommercialPerson
  opportunity: CommercialOpportunity
  className?: string
}

/**
 * Unique commercial client dossier card — single Cliente view.
 */
export function CommercialClientCard({
  person,
  opportunity,
  className,
}: CommercialClientCardProps) {
  const primaryName = resolveCommercialClientDisplayName({
    personType: person.personType,
    firstName: person.firstName,
    lastName: person.lastName,
    companyName: person.companyName,
  })
  const phone = (person.phone || person.mobile).trim()
  const observations = opportunity.description.trim() || person.notes.trim()

  return (
    <Card className={cn("overflow-hidden rounded-xl border shadow-sm", className)}>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Cliente</CardTitle>
          <CommercialEtiquetaBadge
            name={opportunity.etiquetaName}
            color={opportunity.etiquetaColor}
            className="text-sm"
          />
        </div>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          <CommercialInfoRow label="Nombre">{primaryName}</CommercialInfoRow>
          {hasText(phone) ? (
            <CommercialInfoRow label="Teléfono">
              <PhoneLink value={phone} />
            </CommercialInfoRow>
          ) : (
            <CommercialInfoRow label="Teléfono">—</CommercialInfoRow>
          )}
          <CommercialInfoRow label="Dirección">
            {hasText(person.address) ? person.address.trim() : "—"}
          </CommercialInfoRow>
          <CommercialInfoRow label="Observaciones">
            {hasText(observations) ? observations : "—"}
          </CommercialInfoRow>
        </dl>
      </CardContent>
    </Card>
  )
}
