# Product Decisions

## Objetivo

Este documento registra las decisiones estratégicas que definen la arquitectura y la dirección del producto.

Las decisiones aquí documentadas representan la posición oficial de Bespoke Operations.

Toda nueva funcionalidad deberá respetar estas decisiones.

Cuando una decisión deje de ser válida, este documento deberá actualizarse antes de modificar la implementación.

---

## PD-0001

### Bespoke administra trabajo

El propósito principal del producto es organizar y coordinar el trabajo diario de una empresa.

Los registros existen para facilitar la ejecución del trabajo.

Nunca representan el objetivo del sistema.

---

## PD-0002

### Persona es la entidad principal

Toda relación comienza con una Persona.

Una Persona podrá convertirse en Cliente, Contacto, Referido u otra entidad del negocio sin duplicar información.

La identidad de una persona deberá mantenerse durante todo su ciclo de vida.

---

## PD-0003

### El historial es inmutable

Los eventos registrados representan hechos ocurridos.

Nunca deberán modificarse para reflejar una nueva realidad.

Si una situación cambia, deberá registrarse un nuevo evento.

---

## PD-0004

### Toda actividad representa un hecho pasado

Una Actividad describe algo que ya ocurrió.

No representa una tarea futura.

No representa una planificación.

No representa un recordatorio.

---

## PD-0005

### El trabajo futuro se representa mediante Compromisos

Las llamadas pendientes.

Las visitas.

Los seguimientos.

Las reuniones.

Las tareas futuras.

Todo trabajo pendiente deberá representarse mediante Compromisos.

Nunca mediante Actividades.

---

## PD-0006

### Todo proceso debe tener un siguiente paso

Ningún proceso podrá quedar abierto sin definir claramente qué ocurrirá después.

El siguiente paso podrá ser:

- un Compromiso;
- una Espera;
- una derivación;
- o un estado final.

---

## PD-0007

### Los Core Engines pertenecen al producto

Los Core Engines representan capacidades compartidas.

No pertenecen a un módulo específico.

Todo módulo podrá utilizarlos.

Nunca deberán contener reglas exclusivas de un área funcional.

---

## PD-0008

### Los módulos representan procesos de negocio

Los módulos organizan el trabajo de cada sector.

No implementan capacidades generales.

Toda lógica reutilizable deberá implementarse dentro de un Core Engine.

---

## PD-0009

### El crecimiento debe fortalecer la arquitectura

Toda nueva funcionalidad deberá:

- reutilizar motores existentes;
- fortalecer la arquitectura;
- evitar duplicación de lógica;
- mantener la consistencia del producto.

---

## PD-0010

### El Handbook es la referencia oficial

La arquitectura oficial de Bespoke Operations se encuentra documentada en este Handbook.

Ante cualquier diferencia entre implementación y documentación deberá analizarse cuál de las dos requiere evolucionar antes de continuar desarrollando.
