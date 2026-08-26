# OT 1.3 — Domicilio + GPS

Fecha: 2026-08-26. Implementación (no solo auditoría).

## Problemas encontrados

1. `applyCustomerToForm` copiaba calle y localidad, **no** GPS (`sharedLocation`, `latitude`, `longitude`).
2. `handleServiceTypeChange` reseteaba el form con `getDefaultWorkOrderForm()`, borrando cliente, domicilio, GPS y observaciones de Atención/Comercial.
3. El buscador mostraba solo localidad (`📍 Córdoba`) como si fuera domicilio.
4. Prefill Comercial no copiaba coordenadas de la persona.
5. En `cambio-tecnologia` se exigía calle sin mostrar el campo.
6. El GPS se validaba solo como link (`sharedLocation`), ignorando un par lat/lng ya válido.
7. El payload de `cambio-domicilio` podía caer al GPS actual si el nuevo estaba vacío.

No había pérdida en PostgreSQL. El bloqueo era frontend.

## Solución

- Copia de ficha: calle, localidad, GPS. Si hay par válido sin link, se genera URL de Maps. No se inventan coordenadas. Un solo eje no es GPS válido.
- Cambio de tipo: se conservan datos comunes del cliente y se resetean solo campos exclusivos del tipo. `new*` de cambio de domicilio no hereda el GPS actual.
- Validación única: `validateWorkOrderLocation` + `hasWorkOrderStreetAddress` / `hasWorkOrderLocality` / `hasWorkOrderGps`.
- UI: domicilio vs GPS; «GPS cargado» / «GPS pendiente»; label `Sin domicilio registrado · Ciudad`.
- Comercial: copia address/locality y GPS de la persona si existe.
- Enrich: no resuelve Maps si ya hay lat/lng válidos.
- HTML `required` del GPS ya no es la fuente del error.

## Archivos modificados

- `lib/tasks/work-order-location.ts` (nuevo)
- `lib/tasks/work-order-customer-prefill.ts` (nuevo)
- `lib/tasks/work-order.ts`
- `lib/location/client/enrich-task-payload.ts`
- `lib/customers/format.ts`
- `lib/commercial/solicitud-ot-create.ts`
- `components/tareas/task-work-order-dialog.tsx`
- `components/tareas/work-order-location-section.tsx`
- `components/tareas/work-order-address-location-block.tsx`
- `components/tareas/work-order-cambio-tecnologia-fields.tsx`
- `components/location/location-input.tsx`
- `components/gestion-comercial/commercial-dossier-module.tsx`
- `scripts/test-ot-1-3-location.mjs` (nuevo)
- `package.json` (`test:ot-1-3-location`)

No se tocó RPC OT 1.1, migraciones, OT 1.2, Planning ni Facturación.

## Tests

`npm run test:ot-1-3-location`

Cubre copia desde cliente, GPS sintético, localidad ≠ calle, GPS faltante/parcial, Atención + cambio de tipo, Comercial, cambio-domicilio, baja, payload numérico, enrich.

## Criterios de aceptación

1. Cliente con calle + localidad + lat/lng → form cargado, crear permitido.
2. Atención → Generar OT → cambiar tipo **no** borra cliente/calle/localidad/GPS.
3. Solo localidad → `Sin domicilio registrado · Córdoba`; bloqueo por calle.
4. Calle/localidad sin GPS → «Falta la ubicación GPS.»
5. Solo latitude → «La ubicación GPS está incompleta (faltan latitud o longitud).»
6. Cambio de domicilio: GPS actual no se reutiliza como GPS nuevo.

## Limitaciones

- `instalacion-nueva` sigue creando un cliente nuevo al guardar, aunque el form conserve `customerId` de Atención.
- El GPS sigue siendo obligatorio (incl. `baja` sin calle). No se relajó Field Agent.
- La resolución de un link sin coords sigue ocurriendo al guardar (`enrichCreateTaskPayloadWithResolvedLocation`).
