import type { NetworkAgentJob, NetworkDiscoveryTarget } from "@/lib/network/types"

export type NetworkDeviceManageIntent = "test" | "discover" | "replace"

export async function postNetworkDeviceManage(input: {
  deviceId: string
  intent: NetworkDeviceManageIntent
  agentId?: string | null
  protocol?: string
  port?: number
  username?: string
  password?: string
}): Promise<{
  target: NetworkDiscoveryTarget
  job: NetworkAgentJob | null
}> {
  const response = await fetch(`/api/network/devices/${input.deviceId}/manage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: input.intent,
      agentId: input.agentId ?? null,
      protocol: input.protocol,
      port: input.port,
      username: input.username,
      password: input.password ?? "",
    }),
  })
  const body = (await response.json()) as {
    success?: boolean
    message?: string
    target?: NetworkDiscoveryTarget
    job?: NetworkAgentJob | null
  }
  if (!body.success) {
    throw new Error(body.message ?? "No se pudo administrar el dispositivo.")
  }
  if (input.intent !== "replace" && !body.job) {
    throw new Error(body.message ?? "No se pudo administrar el dispositivo.")
  }
  if (!body.target) {
    throw new Error(body.message ?? "No se pudo administrar el dispositivo.")
  }
  return { target: body.target, job: body.job ?? null }
}
