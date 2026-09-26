import type { OperationalChecklistTemplateItem } from "@/lib/tasks/operational-checklist-template"

function item(
  id: string,
  title: string,
  fieldType: OperationalChecklistTemplateItem["fieldType"],
  sortOrder: number
): OperationalChecklistTemplateItem {
  return {
    id,
    title,
    fieldType,
    required: true,
    sortOrder,
  }
}

export const DEMO_MOBILE_TASK_DEFINITIONS = [
  {
    code: "DEMO-MOBILE-001" as const,
    title: "Instalación de cliente",
    description: "OT de demostración Mobile: instalación de cliente.",
    latitude: -34.5735,
    longitude: -58.4218,
    serviceAddress: "Calle Demo 120, Ciudad Norte",
    checklist: [
      item(
        "demo-mobile-001-verificar-instalacion",
        "Verificar instalación",
        "confirmacion",
        1
      ),
      item(
        "demo-mobile-001-verificar-potencia",
        "Verificar potencia",
        "confirmacion",
        2
      ),
      item("demo-mobile-001-conectar-equipo", "Conectar equipo", "confirmacion", 3),
      item(
        "demo-mobile-001-registrar-observacion",
        "Registrar observación",
        "entrada-datos",
        4
      ),
      item("demo-mobile-001-tomar-fotografia", "Tomar fotografía", "fotografia", 5),
    ],
  },
  {
    code: "DEMO-MOBILE-002" as const,
    title: "Reparación de fibra",
    description: "OT de demostración Mobile: reparación de fibra.",
    latitude: -34.5708,
    longitude: -58.4244,
    serviceAddress: "Calle Demo 240, Ciudad Norte",
    checklist: [
      item("demo-mobile-002-verificar-falla", "Verificar falla", "confirmacion", 1),
      item(
        "demo-mobile-002-revisar-conexion",
        "Revisar conexión",
        "confirmacion",
        2
      ),
      item(
        "demo-mobile-002-realizar-reparacion",
        "Realizar reparación",
        "confirmacion",
        3
      ),
      item(
        "demo-mobile-002-verificar-servicio",
        "Verificar servicio",
        "confirmacion",
        4
      ),
      item("demo-mobile-002-tomar-fotografia", "Tomar fotografía", "fotografia", 5),
    ],
  },
  {
    code: "DEMO-MOBILE-003" as const,
    title: "Mantenimiento de red",
    description: "OT de demostración Mobile: mantenimiento de red.",
    latitude: -34.5742,
    longitude: -58.4251,
    serviceAddress: "Calle Demo 360, Ciudad Norte",
    checklist: [
      item(
        "demo-mobile-003-revisar-instalacion",
        "Revisar instalación",
        "confirmacion",
        1
      ),
      item(
        "demo-mobile-003-verificar-conexiones",
        "Verificar conexiones",
        "confirmacion",
        2
      ),
      item(
        "demo-mobile-003-registrar-estado",
        "Registrar estado",
        "entrada-datos",
        3
      ),
      item("demo-mobile-003-tomar-fotografia", "Tomar fotografía", "fotografia", 4),
    ],
  },
] as const
