import { OperarioShell } from "@/components/operario/operario-shell"

export const metadata = {
  title: "Portal de Campo",
  description: "Portal móvil para técnicos y cuadrillas de campo",
}

export default function OperarioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <OperarioShell>{children}</OperarioShell>
}
