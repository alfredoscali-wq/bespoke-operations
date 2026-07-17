import { Badge } from "@/components/ui/badge"
import type { CustomerAtencionStatus } from "@/lib/types/customer-atenciones"
import { formatCustomerAtencionStatusLabel } from "@/lib/customer-atenciones/format"
import { cn } from "@/lib/utils"

function statusBadgeClassName(status: CustomerAtencionStatus): string {
  switch (status) {
    case "nueva":
      return "border-blue-200 bg-blue-500/10 text-blue-700"
    case "para_resolver":
      return "border-amber-200 bg-amber-500/10 text-amber-800"
    case "en_gestion":
      return "border-sky-200 bg-sky-500/10 text-sky-800"
    case "pendiente":
      return "border-violet-200 bg-violet-500/10 text-violet-700"
    case "resuelta":
      return "border-emerald-200 bg-emerald-500/10 text-emerald-700"
    default:
      return ""
  }
}

export function ConsultationStatusBadge({
  status,
  className,
}: {
  status: CustomerAtencionStatus
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn("shrink-0 text-xs", statusBadgeClassName(status), className)}
    >
      {formatCustomerAtencionStatusLabel(status)}
    </Badge>
  )
}
