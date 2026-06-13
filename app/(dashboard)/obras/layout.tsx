import { ProjectsProvider } from "@/components/obras/projects-provider"

export default function ObrasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ProjectsProvider>{children}</ProjectsProvider>
}
