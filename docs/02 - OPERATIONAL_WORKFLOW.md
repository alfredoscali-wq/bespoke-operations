# Workflow Operativo de OT (BASELINE 1.0)

## Flujo principal

El workflow definitivo de una Orden de Trabajo sigue esta secuencia:

```
Programada
    ↓
Asignada
    ↓
En Curso
    ↓
Pendiente de Cierre
    ↓
Finalizada
```

**Finalizada** es el **único estado terminal** de una OT completada con éxito. No existe transición posterior hacia otro estado operativo.

---

## Responsabilidades por estado

### Programada

- OT recién creada o reabierta desde planificación.
- Tiene fecha programada y puede tener cuadrilla sugerida, pero **no está confirmada para ejecución**.
- Participa del carril de planificación (`execution_order`).
- Acciones típicas: editar, asignar cuadrilla, confirmar planificación, cancelar.

**Responsable:** backoffice / supervisor (creación y planificación).

### Asignada

- Cuadrilla confirmada para la fecha programada.
- Lista para iniciar en campo.
- Usa `dispatch_order` (carril operativo).
- Acciones típicas: replanificar, reabrir planificación, iniciar OT (operario), cancelar.

**Responsable:** supervisor (planificación) + operario (inicio).

### En Curso

- Operario inició la ejecución en campo.
- Checklist, pasos operativos, evidencias y GPS pueden registrarse.
- Acciones típicas: completar checklist, cargar evidencias, reportar incidencia, solicitar cierre.

**Responsable:** operario (ejecución) + supervisor (seguimiento).

### Pendiente de Cierre

- Operario solicitó cierre (`submit-for-approval`).
- Checklist y evidencias validadas según reglas del tipo de OT.
- Acciones típicas: aprobar (→ Finalizada) o rechazar (→ En Curso).

**Responsable:** supervisor / administrador con permiso de cierre.

### Finalizada

- OT aprobada y cerrada operativamente.
- Solo lectura en backoffice (**Archivo OT**).
- Puede aplicar efectos comerciales sobre el cliente (según tipo de servicio).

**Responsable:** histórico; sin acciones operativas.

---

## Archivo OT: vista, no estado

**Archivo OT** (`/operations/archivo-ot`) es un **módulo de consulta** que muestra OT con `status = finalizada`.

- No es un estado del workflow.
- No requiere acción manual de “archivado”.
- Las OT finalizadas **no aparecen** en Órdenes de Trabajo (`/tareas`), que lista únicamente OT activas: programada, asignada, en-curso y pendiente-cierre.

---

## Estados auxiliares (fuera del flujo lineal)

Estos estados existen en el sistema pero **no forman parte de la secuencia principal** documentada arriba:

| Estado | Significado | Retorno típico |
|--------|-------------|----------------|
| **Vencida** | OT asignada no iniciada en la fecha programada | Replanificar → Asignada |
| **Incidencia** | Operario reportó un impedimento en campo | Retomar → En Curso; replanificar → Asignada |
| **En aprobación** | Alias legacy de pendiente de cierre (misma lógica de cierre) | Aprobar → Finalizada |
| **Cancelada** | OT anulada antes de completarse | Terminal (distinto de Finalizada) |

El trigger de base de datos `enforce_task_status_workflow` valida todas las transiciones permitidas.

---

## Acciones de workflow

| Acción | Desde | Hacia |
|--------|-------|-------|
| Confirmar planificación | Programada | Asignada |
| Reabrir planificación | Asignada, Vencida | Programada |
| Iniciar | Asignada | En Curso |
| Solicitar cierre | En Curso | Pendiente de Cierre |
| Reportar incidencia | En Curso | Incidencia |
| Retomar incidencia | Incidencia | En Curso |
| Replanificar incidencia | Incidencia | Asignada |
| Replanificar vencida | Vencida | Asignada |
| Aprobar | Pendiente de Cierre / En aprobación | Finalizada |
| Rechazar cierre | Pendiente de Cierre / En aprobación | En Curso |
| Cancelar | Varios estados activos | Cancelada |

---

## Restricciones en Archivo OT

Desde Archivo OT y en OT finalizadas **no se permite**:

- Editar
- Eliminar
- Replanificar
- Reasignar cuadrilla
- Cambiar estado
- Aprobar o cancelar

El detalle es de **solo lectura**: resumen, checklist, fotografías, evidencias, historial e información administrativa.
