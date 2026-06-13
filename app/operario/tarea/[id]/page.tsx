import { OperarioTaskDetailScreen } from "@/components/operario/operario-task-detail-screen"

type OperarioTaskDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function OperarioTaskDetailPage({
  params,
}: OperarioTaskDetailPageProps) {
  const { id } = await params

  return <OperarioTaskDetailScreen id={id} />
}
