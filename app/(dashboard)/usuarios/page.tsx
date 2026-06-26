import { UserCog } from "lucide-react"

import { PlaceholderPanel } from "@/components/ui/placeholder-panel"

export default function UsuariosPage() {
  return (
    <PlaceholderPanel
      icon={UserCog}
      title="Usuarios del Sistema"
      description="Gestión de accesos y cuentas. Este módulo se habilitará con el sistema de permisos."
    />
  )
}
