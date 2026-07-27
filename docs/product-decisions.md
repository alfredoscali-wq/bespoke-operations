# Product Decisions

Este documento registra las decisiones estratégicas de arquitectura del producto.

Las decisiones aquí documentadas representan la dirección oficial de Bespoke Operations.

Cuando exista una contradicción entre una implementación y este documento, deberá revisarse la arquitectura antes de continuar desarrollando.

---

## PD-0001

Título

Bespoke administra trabajo.

Decisión

El objetivo principal del producto es coordinar el trabajo diario de una empresa.

Los datos existen para facilitar la ejecución.

Nunca son un objetivo por sí mismos.

---

## PD-0002

Título

La entidad principal es Persona.

Decisión

El sistema deja de pensar en Prospectos.

Toda relación comienza con una Persona.

Una Persona podrá convertirse en Cliente, Referido, Ex Cliente o Contacto sin duplicar información.

---

## PD-0003

Título

El historial es inmutable.

Decisión

Nunca se modifica la historia.

Toda acción genera un nuevo evento.

Los eventos anteriores permanecen disponibles para reconstruir cualquier proceso.

---

## PD-0004

Título

Toda actividad representa un hecho ocurrido.

Decisión

Una actividad siempre describe algo que ya sucedió.

No representa trabajo futuro.

---

## PD-0005

Título

El trabajo futuro se representa mediante Compromisos.

Decisión

Las tareas pendientes, seguimientos, visitas, llamadas y acciones futuras serán representadas mediante Compromisos.

Nunca mediante Actividades.

---

## PD-0006

Título

Todo proceso debe tener un siguiente paso.

Decisión

Ningún expediente puede quedar abierto sin:

- un compromiso,
- una condición de espera,
- o un estado final.

---

## PD-0007

Título

Mi Jornada será la pantalla principal.

Decisión

Todos los módulos deberán ofrecer una vista orientada al trabajo diario.

El usuario inicia su jornada desde "Mi Jornada".

No desde un listado de registros.

---

## PD-0008

Título

Los motores pertenecen al producto.

Decisión

Los motores representan capacidades reutilizables.

No pueden contener lógica específica de un módulo.

---

## PD-0009

Título

Los módulos representan procesos de negocio.

Decisión

Operaciones, Comercial, Atención, Administración y RRHH representan áreas funcionales.

Los módulos consumen motores.

Nunca implementan motores propios.

---

## PD-0010

Título

La arquitectura evoluciona mediante motores.

Decisión

Toda nueva funcionalidad deberá fortalecer un motor existente o justificar la creación de uno nuevo.

No se permitirá duplicar lógica entre módulos.
