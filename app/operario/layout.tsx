import { OperarioShell } from "@/components/operario/operario-shell"

export const metadata = {
  title: "Portal Operario",
  description: "Portal móvil para operarios y cuadrillas de campo",
}

export default function OperarioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <OperarioShell>{children}</OperarioShell>
}
