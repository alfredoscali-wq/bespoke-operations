"use client"

import {
  COMMERCIAL_ACTIVITY_TYPE_ICONS,
} from "@/components/gestion-comercial/commercial-activity-icons"
import { Button } from "@/components/ui/button"
import {
  COMMERCIAL_ACTIVITY_TYPE_LABELS,
  COMMERCIAL_QUICK_ACTIVITY_TYPES,
  type CommercialQuickActivityType,
} from "@/lib/commercial/activity-catalogs"

type CommercialActivityQuickActionsProps = {
  onSelect: (typeCode: CommercialQuickActivityType) => void
  disabled?: boolean
}

export function CommercialActivityQuickActions({
  onSelect,
  disabled = false,
}: CommercialActivityQuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {COMMERCIAL_QUICK_ACTIVITY_TYPES.map((typeCode) => {
        const Icon = COMMERCIAL_ACTIVITY_TYPE_ICONS[typeCode]
        return (
          <Button
            key={typeCode}
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onSelect(typeCode)}
          >
            <Icon className="size-3.5" aria-hidden />
            {COMMERCIAL_ACTIVITY_TYPE_LABELS[typeCode]}
          </Button>
        )
      })}
    </div>
  )
}
