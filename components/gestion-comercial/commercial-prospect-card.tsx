"use client"

import { CommercialInfoRow } from "@/components/gestion-comercial/commercial-info-row"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  personTypeLabel,
  resolvePersonPrimaryName,
} from "@/lib/commercial/display"
import type { CommercialPerson } from "@/lib/types/commercial"
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

function EmailLink({ value }: { value: string }) {
  return (
    <a
      href={`mailto:${value}`}
      className="font-medium text-primary hover:underline"
    >
      {value}
    </a>
  )
}

type CommercialProspectCardProps = {
  person: CommercialPerson
  className?: string
}

export function CommercialProspectCard({
  person,
  className,
}: CommercialProspectCardProps) {
  const primaryName = resolvePersonPrimaryName(person)
  const documentValue = person.documentNumber.trim() || person.taxId.trim()

  return (
    <Card className={cn("overflow-hidden rounded-xl border shadow-sm", className)}>
      <CardHeader className="space-y-0">
        <CardTitle className="text-base">Persona</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          <CommercialInfoRow label="Tipo">
            {personTypeLabel(person.personType)}
          </CommercialInfoRow>
          {primaryName !== "-" ? (
            <CommercialInfoRow label="Nombre / Razón Social">
              {primaryName}
            </CommercialInfoRow>
          ) : null}
          {hasText(documentValue) ? (
            <CommercialInfoRow label="Documento / CUIT">
              {documentValue}
            </CommercialInfoRow>
          ) : null}
          {hasText(person.phone) ? (
            <CommercialInfoRow label="Teléfono">
              <PhoneLink value={person.phone.trim()} />
            </CommercialInfoRow>
          ) : null}
          {hasText(person.mobile) ? (
            <CommercialInfoRow label="Celular">
              <PhoneLink value={person.mobile.trim()} />
            </CommercialInfoRow>
          ) : null}
          {hasText(person.email) ? (
            <CommercialInfoRow label="Email">
              <EmailLink value={person.email.trim()} />
            </CommercialInfoRow>
          ) : null}
          {hasText(person.address) ? (
            <CommercialInfoRow label="Dirección">
              {person.address.trim()}
            </CommercialInfoRow>
          ) : null}
          {hasText(person.city) ? (
            <CommercialInfoRow label="Ciudad">
              {person.city.trim()}
            </CommercialInfoRow>
          ) : null}
          {hasText(person.province) ? (
            <CommercialInfoRow label="Provincia">
              {person.province.trim()}
            </CommercialInfoRow>
          ) : null}
          {hasText(person.postalCode) ? (
            <CommercialInfoRow label="Código Postal">
              {person.postalCode.trim()}
            </CommercialInfoRow>
          ) : null}
          {hasText(person.notes) ? (
            <CommercialInfoRow label="Notas">
              {person.notes.trim()}
            </CommercialInfoRow>
          ) : null}
        </dl>
      </CardContent>
    </Card>
  )
}
