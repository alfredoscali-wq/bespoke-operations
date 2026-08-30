export const networkQueryKeys = {
  all: ["network"] as const,
  devices: () => ["network", "devices"] as const,
  device: (deviceId: string) => ["network", "devices", deviceId] as const,
  deviceHistory: (deviceId: string) =>
    ["network", "devices", deviceId, "history"] as const,
  summary: () => ["network", "summary"] as const,
  topology: () => ["network", "topology"] as const,
}
