# Core Engines

## Objetivo

Los Core Engines representan las capacidades fundamentales de Bespoke.

No pertenecen a ningún módulo específico.

Constituyen el núcleo funcional del producto y pueden ser utilizados por cualquier área del sistema.

Mientras los módulos representan procesos de negocio, los Engines representan capacidades reutilizables.

---

# Filosofía

Bespoke evita duplicar lógica entre módulos.

Cuando una funcionalidad puede ser utilizada por más de un módulo, deja de pertenecer a ese módulo y pasa a convertirse en un Engine.

De esta manera:

- Comercial reutiliza Engines.
- Atención al Cliente reutiliza Engines.
- Operaciones reutiliza Engines.
- RRHH reutiliza Engines.
- Administración reutiliza Engines.

Los Engines constituyen una biblioteca de capacidades compartidas.

---

# Diferencia entre Engine y Module

Un Module responde a la pregunta:

"¿Cómo trabaja esta área de la empresa?"

Un Engine responde a la pregunta:

"¿Qué capacidad necesita cualquier área de la empresa?"

Por ejemplo:

Registrar una actividad.

No es un proceso comercial.

No es un proceso operativo.

Es una capacidad general.

Por lo tanto pertenece al Activity Engine.

---

# Motores oficiales

La arquitectura de Bespoke define actualmente los siguientes Core Engines.

## Activity Engine

Administra el historial operativo del sistema.

Registra hechos ocurridos.

Constituye la memoria del producto.

---

## Agenda Engine

Administra trabajo pendiente.

Centraliza compromisos.

Organiza tareas futuras.

---

## Planning Engine

Administra planificación operativa.

Recursos.

Cuadrillas.

Calendarios.

Disponibilidad.

Programaciones.

---

## Automation Engine

Ejecuta reglas automáticas.

Dispara acciones.

Orquesta procesos sin intervención humana.

---

## Notification Engine

Centraliza todas las comunicaciones.

Notificaciones.

Alertas.

Recordatorios.

Mensajes.

---

## Reporting Engine

Genera indicadores.

Analiza información.

Construye métricas.

Produce reportes.

---

# Beneficios

La utilización de Engines proporciona:

- reutilización;
- consistencia;
- menor duplicación;
- menor acoplamiento;
- mayor mantenibilidad;
- mayor escalabilidad.

---

# Comunicación

Los Engines pueden colaborar entre sí.

Sin embargo deben permanecer independientes.

Cada Engine posee una única responsabilidad.

Cuando un proceso requiere varias capacidades, la coordinación corresponde al módulo que inició el proceso.

---

# Evolución

Nuevos Engines pueden incorporarse cuando aparezca una capacidad verdaderamente transversal.

No debe crearse un nuevo Engine para resolver un problema exclusivo de un único módulo.

Los Engines representan capacidades compartidas del producto.

---

# Regla de decisión

Antes de implementar una nueva funcionalidad debe responderse la siguiente pregunta.

¿Podría otro módulo necesitar exactamente esta misma capacidad?

Si la respuesta es sí, probablemente pertenece a un Engine.

Si la respuesta es no, probablemente pertenece al módulo.

---

# Objetivo final

El propósito de los Core Engines es permitir que Bespoke crezca mediante reutilización.

Cada nueva funcionalidad debería fortalecer el núcleo del producto en lugar de aumentar la duplicación entre módulos.
