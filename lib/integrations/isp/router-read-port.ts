import type {
  MikrotikIdentity,
  MikrotikInterfacesSummary,
  MikrotikSystemResource,
} from "@/lib/integrations/mikrotik/types"

/**
 * ISP Integration Layer — read port used by Bespoke.
 * Future SubscriberService / TelemetryService must depend on this port,
 * not on fetch() or RouterOS /rest paths.
 */
export type IspRouterReadPort = {
  testConnection(): Promise<{
    identity: MikrotikIdentity
    resource: MikrotikSystemResource
    interfaces: MikrotikInterfacesSummary | null
  }>
  getIdentity(): Promise<MikrotikIdentity>
  getSystemResource(): Promise<MikrotikSystemResource>
  getInterfacesSummary(): Promise<MikrotikInterfacesSummary>
}
