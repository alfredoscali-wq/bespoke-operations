import { ContratistasModuleProviders } from "@/components/providers/contratistas-module-providers"

export default function ContratistasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ContratistasModuleProviders>{children}</ContratistasModuleProviders>
}
