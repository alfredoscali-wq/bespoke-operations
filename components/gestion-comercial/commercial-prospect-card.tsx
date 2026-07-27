"use client"

import { CommercialInfoRow } from "@/components/gestion-comercial/commercial-info-row"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  displayCommercialValue,
  personTypeLabel,
  resolvePersonPrimaryName,
} from "@/lib/commercial/display"
import type { CommercialPerson } from "@/lib/types/commercial"
import { cn } from "@/lib/utils"

function PhoneLink({ value }: { value: string }) {
  const trimmed = value.trim()
  if (!trimmed) return <span>-</span>
  return (
    <a
      href={`tel:${trimmed.replace(/\s+/g, "")}`}
      className="font-medium text-primary hover:underline"
    >
      {trimmed}
    </a>
  )
}

function EmailLink({ value }: { value: string }) {
  const trimmed = value.trim()
  if (!trimmed) return <span>-</span>
  return (
    <a
      href={`mailto:${trimmed}`}
      className="font-medium text-primary hover:underline"
    >
      {trimmed}
    </a>
  )
}

type CommercialProspectCardProps = {
  person: CommercialPerson
  onEdit: () => void
  className?: string
}

export function CommercialProspectCard({
  person,
  onEdit,
  className,
}: CommercialProspectCardProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Prospecto</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          Editar Prospecto
        </Button>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          <CommercialInfoRow label="Tipo">
            {personTypeLabel(person.personType)}
          </CommercialInfoRow>
          <CommercialInfoRow label="Nombre / Razón Social">
            {resolvePersonPrimaryName(person)}
          </CommercialInfoRow>
          <CommercialInfoRow label="Documento / CUIT">
            {displayCommercialValue(
              person.documentNumber || person.taxId || null
            )}
          </CommercialInfoRow>
          <CommercialInfoRow label="Teléfono">
            <PhoneLink value={person.phone} />
          </CommercialInfoRow>
          <CommercialInfoRow label="Celular">
            <PhoneLink value={person.mobile} />
          </CommercialInfoRow>
          <CommercialInfoRow label="Email">
            <EmailLink value={person.email} />
          </CommercialInfoRow>
          <CommercialInfoRow label="Dirección">
            {displayCommercialValue(person.address)}
          </CommercialInfoRow>
          <CommercialInfoRow label="Ciudad">
            {displayCommercialValue(person.city)}
          </CommercialInfoRow>
          <CommercialInfoRow label="Provincia">
            {displayCommercialValue(person.province)}
          </CommercialInfoRow>
          <CommercialInfoRow label="Código Postal">
            {displayCommercialValue(person.postalCode)}
          </CommercialInfoRow>
          <CommercialInfoRow label="Notas">
            {displayCommercialValue(person.notes)}
          </CommercialInfoRow>
        </dl>
      </CardContent>
    </Card>
  )
}
