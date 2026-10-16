import { MikrotikClient } from "@/lib/integrations/mikrotik/client"
import type { IspRouterReadPort } from "@/lib/integrations/isp/router-read-port"
import type { MikrotikClientConfig } from "@/lib/integrations/mikrotik/types"

/**
 * MikroTik Adapter — RouterOS REST implementation of the ISP read port.
 * Subscriber/PPPoE/Queue operations belong to later phases and must be added
 * here rather than called from Clientes 360.
 */
export class MikrotikAdapter implements IspRouterReadPort {
  private readonly client: MikrotikClient

  constructor(config: MikrotikClientConfig) {
    this.client = new MikrotikClient(config)
  }

  async testConnection() {
    const result = await this.client.testConnection()
    return {
      identity: result.identity,
      resource: result.resource,
      interfaces: result.interfaces,
    }
  }

  getIdentity() {
    return this.client.getIdentity()
  }

  getSystemResource() {
    return this.client.getSystemResource()
  }

  getInterfacesSummary() {
    return this.client.getInterfacesSummary()
  }
}

export function createMikrotikAdapter(config: MikrotikClientConfig): IspRouterReadPort {
  return new MikrotikAdapter(config)
}
