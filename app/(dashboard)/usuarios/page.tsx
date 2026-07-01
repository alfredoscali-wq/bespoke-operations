import { UserCog } from "lucide-react"

import { PlaceholderPanel } from "@/components/ui/placeholder-panel"

export default function UsuariosPage() {
  return (
    <PlaceholderPanel
      icon={UserCog}
      title="Usuarios"
      description="Administra el acceso al sistema: cuentas, credenciales y permisos de ingreso. La información de empleados se gestiona en RRHH."
    />
  )
}
