# Ciclo de Vida del Cliente (BASELINE 1.0)

## Flujo principal de estado comercial

```
Instalación Nueva (OT aprobada)
    ↓
Pendiente de Activación
    ↓
Activo
```

### Instalación Nueva → Pendiente de Activación

Cuando una OT de tipo **Instalación Nueva** es **aprobada** (transición a Finalizada), el sistema actualiza automáticamente la ficha del cliente:

- Estado → `pendiente-activacion`
- Sincroniza tecnología, domicilio, plan contratado y datos FTTH cuando corresponda

Esta transición ocurre **una sola vez** al cerrar la instalación, no al crear la OT.

### Pendiente de Activación → Activo

La activación comercial es una **acción manual** en el módulo Clientes (“Activar cliente”). Backoffice marca al cliente como `activo` cuando la operación comercial confirma el alta del servicio.

No existe activación automática al aprobar la OT de instalación.

### Activo

Cliente operativo con servicio en curso. Puede recibir OT de mantenimiento, cambios o baja.

---

## Otros efectos al aprobar OT (tipos comerciales)

Solo ciertos tipos de servicio modifican la ficha del cliente al aprobar la OT:

| Tipo de OT | Efecto sobre el cliente |
|------------|-------------------------|
| Instalación Nueva | → Pendiente de activación + datos técnicos |
| Cambio de Domicilio | Actualiza domicilio, localidad, GPS |
| Cambio de Tecnología | Actualiza tecnología, plan, FTTH |
| Baja | → Inactivo (+ motivo) |
| Reconexión | → Activo (limpia motivo de baja) |

---

## OT de Service: no modifican el estado del cliente

Los siguientes tipos de OT **no cambian** el estado comercial del cliente al aprobarse:

- Service Técnico
- Postventa
- Relevamiento
- Retiro de Equipo

Estas OT pueden actualizar datos puntuales de la OT, pero la regla de negocio es clara: **no mueven el estado del cliente**.

---

## Actualizar ficha del cliente

La edición manual de la ficha en el módulo Clientes **mantiene el flujo actual**:

- Un operador puede corregir teléfono, domicilio, tecnología u otros campos.
- La sincronización desde OT al crear/editar una orden (preview de cambios) sigue el comportamiento existente de `customer-sync`.
- Marcar como activo, inactivo o activar desde pendiente de activación son acciones explícitas del operador de backoffice.

---

## Estados comerciales

| Estado | Significado |
|--------|-------------|
| `activo` | Cliente con servicio operativo |
| `pendiente-activacion` | Instalación completada; pendiente de alta comercial |
| `inactivo` | Baja o suspensión comercial |

Los filtros operativos del módulo Clientes agrupan: Operativos, Activos, Pendientes de activación y Revisar.

---

## Relación OT ↔ Cliente

- Toda OT de servicio vincula un `customer_id`.
- Los efectos comerciales se aplican **al aprobar** la OT (no al solicitar cierre ni al iniciar).
- El historial de cambios queda registrado en auditoría (`work-order-approval-audit`).
