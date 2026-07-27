import {
  ArrowLeftRight,
  CheckCircle2,
  Clock3,
  FileText,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Settings2,
  StickyNote,
  Users,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

import type { CommercialActivityTypeCode } from "@/lib/commercial/activity-catalogs"

export const COMMERCIAL_ACTIVITY_TYPE_ICONS: Record<
  CommercialActivityTypeCode,
  LucideIcon
> = {
  llamada: Phone,
  whatsapp: MessageCircle,
  email: Mail,
  visita: MapPin,
  reunion: Users,
  nota: StickyNote,
  tarea: FileText,
  seguimiento: RefreshCw,
  cambio_estado: ArrowLeftRight,
  sistema: Settings2,
}

export function CommercialActivityStatusIcon({
  status,
}: {
  status: "pending" | "completed"
}) {
  if (status === "completed") {
    return (
      <CheckCircle2
        className="size-3.5 shrink-0 text-emerald-600"
        aria-label="Completada"
      />
    )
  }
  return (
    <Clock3
      className="size-3.5 shrink-0 text-amber-600"
      aria-label="Pendiente"
    />
  )
}
