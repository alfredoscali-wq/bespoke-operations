import type {
  OperationalStep,
  OperationalStepKind,
} from "@/lib/types/tasks"

export const DEFAULT_OPERATIONAL_STEP_LABELS = [
  "Paso Operativo 1",
  "Paso Operativo 2",
  "Paso Operativo 3",
] as const

export type InstallationOperationalTechnology = "fiber" | "wireless"

type InstallationStepTemplate = {
  label: string
  stepKind: OperationalStepKind
  stepKey: string
}

const FIBER_INSTALLATION_STEP_TEMPLATES: InstallationStepTemplate[] = [
  { label: "Caja NAP", stepKind: "text", stepKey: "nap_box" },
  { label: "Puerto NAP", stepKind: "text", stepKey: "nap_port" },
  { label: "Serial ONU", stepKind: "text", stepKey: "onu_serial" },
  { label: "Foto ONU", stepKind: "photo", stepKey: "onu_photo" },
  { label: "Foto Señal ONU", stepKind: "photo", stepKey: "onu_signal_photo" },
  { label: "Foto Speedtest", stepKind: "photo", stepKey: "speedtest_photo" },
]

const WIRELESS_INSTALLATION_STEP_TEMPLATES: InstallationStepTemplate[] = [
  { label: "MAC Equipo", stepKind: "text", stepKey: "equipment_mac" },
  {
    label: "Foto Equipo Exterior",
    stepKind: "photo",
    stepKey: "equipment_photo",
  },
  { label: "Foto Router", stepKind: "photo", stepKey: "router_photo" },
  { label: "Foto Speedtest", stepKind: "photo", stepKey: "speedtest_photo" },
]

function createOperationalStepsFromTemplates(
  templates: InstallationStepTemplate[]
): OperationalStep[] {
  return templates.map((template) => ({
    id: crypto.randomUUID(),
    label: template.label,
    observation: "",
    completedAt: null,
    stepKind: template.stepKind,
    stepKey: template.stepKey,
  }))
}

export function createDefaultOperationalSteps(): OperationalStep[] {
  return DEFAULT_OPERATIONAL_STEP_LABELS.map((label) => ({
    id: crypto.randomUUID(),
    label,
    observation: "",
    completedAt: null,
  }))
}

export function createInstallationOperationalSteps(
  technology: InstallationOperationalTechnology
): OperationalStep[] {
  const templates =
    technology === "wireless"
      ? WIRELESS_INSTALLATION_STEP_TEMPLATES
      : FIBER_INSTALLATION_STEP_TEMPLATES

  return createOperationalStepsFromTemplates(templates)
}
