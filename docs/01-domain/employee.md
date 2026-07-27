# Employee

## Propósito

Empleado representa una Persona que presta servicios para la empresa.

Todo Empleado es una Persona.

No toda Persona es un Empleado.

---

## Responsabilidades

Relacionar la Persona con la estructura organizacional.

Asignar:

- área;
- rol;
- permisos;
- cuadrillas;
- disponibilidad;
- jornada laboral.

---

## No es responsabilidad

Empleado no representa:

- autenticación;
- usuarios del sistema;
- permisos técnicos;
- contratos comerciales.

Esos conceptos pertenecen a otros componentes del sistema.

---

## Relaciones

Un Empleado puede:

- pertenecer a una o más áreas;
- integrar una cuadrilla;
- ejecutar órdenes de trabajo;
- registrar actividades;
- recibir compromisos;
- participar en procesos de planificación.

---

## Principios

La información personal pertenece a Persona.

La información laboral pertenece a Empleado.

Esta separación evita duplicación de datos y permite que una Persona pueda asumir distintos roles durante su ciclo de vida.

---

## Regla principal

Empleado representa la relación laboral.

Persona representa la identidad.

Nunca deben mezclarse ambos conceptos.
