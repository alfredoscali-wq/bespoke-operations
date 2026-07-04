# Planificación Operativa (BASELINE 1.0)

## Propósito

La planificación operativa ordena las OT del día por cuadrilla **antes y durante la jornada**, definiendo la secuencia de visitas que seguirá cada equipo en campo.

Ruta: `/operations/planificacion`

---

## Dos carriles de orden

BASELINE 1.0 separa el orden en dos campos:

### `execution_order` — Carril de planificación

- Aplica a OT en estado **Programada**.
- Define la posición propuesta en la cola de planificación del día.
- Editable mientras la OT permanece programada.
- Al confirmar planificación, se copia al carril operativo.

### `dispatch_order` — Carril operativo

- Aplica a OT **Asignada** y estados posteriores (excepto Programada).
- Define la posición real de ruta confirmada para la cuadrilla.
- Es el orden que ve el operario en agenda y Portal Operario.

```
Programada  →  execution_order
Asignada+   →  dispatch_order
```

---

## Planificar (confirmación incremental)

**Planificar** confirma OT programadas hacia la cuadrilla asignada:

1. Cambia estado **Programada → Asignada**.
2. Copia `execution_order` → `dispatch_order`.
3. Asigna posiciones nuevas al final de la cola de la cuadrilla (modo incremental).

Usado cuando se confirman OT nuevas sin reordenar toda la ruta del día.

---

## Replanificar

**Replanificar** regenera `dispatch_order` para un conjunto de OT de la cuadrilla:

- Reordena OT programadas/reabiertas según `execution_order`.
- **Respeta slots congelados** de OT que ya están en curso o más allá.
- No mueve OT con ruta congelada (en-curso, incidencia, pendiente-cierre).

Modo: `replan` vs `incremental` en la confirmación de planificación.

---

## Planificación Dinámica

La planificación dinámica gestiona OT que **aún no comenzaron**:

| Pool dinámico | Estados |
|---------------|---------|
| Editables | Programada, Asignada, Vencida |
| Ruta congelada | En Curso, Incidencia, Pendiente de Cierre, En aprobación |

Reglas:

- OT **reabribles** para planificación: Asignada y Vencida → vuelven a Programada.
- OT en curso o pendientes de cierre **mantienen** su `dispatch_order` (no vuelven al pool editable).
- Al replanificar, los slots ocupados por OT congeladas se **saltan** al asignar nuevas posiciones.

---

## Restricciones

| Restricción | Detalle |
|-------------|---------|
| Solo OT de servicio/obra del día | Filtro por `due_date` en la vista de planificación |
| Reorden solo en Programada | `execution_order` editable únicamente en estado programada |
| Cuadrilla obligatoria | OT sin cuadrilla no se confirman |
| Ruta congelada | OT iniciadas no vuelven al mapa editable |
| Vencida | OT no iniciada a tiempo; requiere replanificación antes de iniciar |
| No transaccional atómico | La confirmación masiva usa múltiples actualizaciones (ver limitaciones) |

---

## Vista de planificación

La interfaz muestra:

- Mapa con marcadores ordenados por cuadrilla
- Lista de OT del día filtrable por cuadrilla
- Acciones: confirmar, replanificar, reabrir, editar orden de ejecución

El calendario operativo (`/operations/calendar`) complementa la planificación con vista semanal; la edición de ruta ocurre en Planificación Operativa.
