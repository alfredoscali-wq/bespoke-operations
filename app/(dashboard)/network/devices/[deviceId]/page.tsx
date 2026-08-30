import { NetworkDeviceDetailScreen } from "@/components/network/network-device-detail-screen"

type PageProps = {
  params: Promise<{ deviceId: string }>
}

export default async function NetworkDeviceDetailPage({ params }: PageProps) {
  const { deviceId } = await params
  return <NetworkDeviceDetailScreen deviceId={deviceId} />
}
