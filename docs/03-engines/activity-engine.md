# Activity Engine

## Objetivo

El Activity Engine es el motor encargado de registrar todos los hechos ocurridos dentro de Bespoke.

Constituye la memoria operativa del sistema.

Su propósito es garantizar que toda acción relevante quede registrada de forma consistente, independientemente del módulo desde el cual se origine.

---

# Filosofía

Todo lo que ocurrió debe transformarse en una Actividad.

No importa si ocurrió en:

- Comercial;
- Atención al Cliente;
- Operaciones;
- Administración;
- Recursos Humanos;
- cualquier módulo futuro.

Si representa un hecho relevante para el negocio, debe existir una Actividad.

---

# Problema que resuelve

Sin un motor centralizado, cada módulo termina implementando su propio historial.

Eso produce:

- distintos formatos;
- reglas inconsistentes;
- duplicación;
- dificultad para auditar.

El Activity Engine elimina ese problema proporcionando un único modelo para registrar el pasado.

---

# Responsabilidades

El Activity Engine es responsable de:

- registrar hechos;
- mantener historial;
- conservar auditoría funcional;
- asociar actividades a entidades del dominio;
- garantizar consistencia temporal;
- preservar la trazabilidad.

---

# No es responsabilidad

El Activity Engine no administra:

- trabajo futuro;
- recordatorios;
- tareas pendientes;
- planificación;
- automatizaciones;
- notificaciones.

Esas responsabilidades pertenecen a otros Engines.

---

# Concepto fundamental

Una Actividad representa algo que ya ocurrió.

Nunca representa algo que debe ocurrir.

Esta diferencia es uno de los principios fundamentales de Bespoke.

---

# Ejemplos

Se creó una oportunidad.

↓

Actividad.

---

Se realizó una llamada.

↓

Actividad.

---

Se envió una propuesta.

↓

Actividad.

---

Se asignó una Orden de Trabajo.

↓

Actividad.

---

Un técnico inició una tarea.

↓

Actividad.

---

Un cliente realizó un pago.

↓

Actividad.

---

Se modificó el estado de un proyecto.

↓

Actividad.

---

# Relaciones

Una Actividad puede estar vinculada con cualquier entidad del dominio.

Por ejemplo:

Persona

Cliente

Empleado

Oportunidad

Expediente Comercial

Proyecto

Orden de Trabajo

Compromiso

o cualquier entidad futura.

El Activity Engine no depende de una entidad específica.

---

# Características

Las Actividades son:

cronológicas;

auditables;

consultables;

inmutables;

trazables.

---

# Inmutabilidad

Una Actividad representa un hecho histórico.

Por ese motivo no debe modificarse.

Si un hecho cambia, debe registrarse una nueva Actividad.

El historial debe reflejar exactamente lo ocurrido.

Nunca una reinterpretación del pasado.

---

# Utilización

Todos los módulos del sistema pueden utilizar el Activity Engine.

No existen actividades exclusivas de un módulo.

Existe un único historial operativo para todo Bespoke.

---

# Interacción con otros Engines

El Activity Engine puede colaborar con:

Agenda Engine

registrando el cumplimiento de un Compromiso.

Planning Engine

registrando cambios en la planificación.

Automation Engine

registrando acciones automáticas ejecutadas.

Notification Engine

registrando comunicaciones enviadas.

Reporting Engine

proporcionando información histórica para indicadores.

---

# Eventos típicos

El Activity Engine normalmente registra eventos como:

Creación

Actualización significativa

Cambio de estado

Asignación

Inicio

Finalización

Cancelación

Comunicación

Aprobación

Rechazo

Derivación

Resolución

No limita la naturaleza del evento.

Únicamente garantiza su registro.

---

# Reglas arquitectónicas

Toda Actividad posee un contexto.

Toda Actividad posee un momento.

Toda Actividad posee un origen.

Toda Actividad representa un hecho.

Las Actividades nunca representan trabajo pendiente.

---

# Objetivo final

El Activity Engine constituye la memoria institucional de Bespoke.

Gracias a este motor es posible reconstruir cualquier proceso de negocio, comprender decisiones pasadas y mantener una trazabilidad completa del funcionamiento del sistema.
