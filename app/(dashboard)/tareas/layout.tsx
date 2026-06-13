import { TasksProvider } from "@/components/tareas/tasks-provider"

export default function TareasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <TasksProvider>{children}</TasksProvider>
}
