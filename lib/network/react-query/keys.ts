export const networkQueryKeys = {
  all: ["network"] as const,
  devices: () => ["network", "devices"] as const,
  device: (deviceId: string) => ["network", "devices", deviceId] as const,
  summary: () => ["network", "summary"] as const,
}
