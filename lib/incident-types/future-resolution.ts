/**
 * Resolución de incidencias — flujo futuro (no implementado en esta versión).
 *
 * Cuando un tipo de incidencia tiene `requiresSupervisorIntervention = true` y una
 * cuadrilla lo reporta durante la ejecución de una OT:
 *
 * 1. La OT queda pausada hasta que el supervisor resuelva la incidencia.
 * 2. El supervisor es responsable de decidir cómo continúa la OT.
 *
 * Resoluciones previstas para la versión 1.0 del sprint de incidencias:
 * - Continuar la OT.
 * - Reprogramar la OT.
 * - Cancelar la OT.
 *
 * Este módulo documenta el concepto de producto; la lógica operativa se
 * implementará en un sprint posterior.
 */
export const INCIDENT_RESOLUTION_FUTURE_SPRINT = "incident-resolution-v1" as const
