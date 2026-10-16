import { MikrotikClient } from "@/lib/integrations/mikrotik/client"
import { MikrotikIntegrationError } from "@/lib/integrations/mikrotik/errors"
import type {
  MikrotikClientConfig,
  MikrotikConnectionTestResult,
} from "@/lib/integrations/mikrotik/types"

export async function testMikrotikConnection(
  config: MikrotikClientConfig & { enabled?: boolean }
): Promise<MikrotikConnectionTestResult> {
  if (config.enabled === false) {
    throw new MikrotikIntegrationError("ROUTER_DISABLED")
  }

  const client = new MikrotikClient(config)
  return client.testConnection()
}
