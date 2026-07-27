# Person

## Propósito

Persona es la entidad raíz del dominio de Bespoke Operations.

Representa a cualquier individuo con el que la empresa mantiene o puede mantener una relación.

Toda interacción del negocio comienza con una Persona.

Una Persona puede evolucionar a lo largo del tiempo sin perder su identidad.

El sistema nunca deberá duplicar Personas para representar diferentes roles.

---

## ¿Por qué existe?

En muchos sistemas una misma persona termina registrada varias veces.

Por ejemplo:

- Prospecto
- Cliente
- Referido
- Contacto
- Ex Cliente

Cada registro representa a la misma persona pero almacenada como entidades distintas.

Esto genera duplicación de información, inconsistencias y pérdida del historial.

Bespoke elimina ese problema utilizando una única entidad llamada Persona.

---

## Responsabilidades

Persona representa la identidad de un individuo.

Es responsable de concentrar la información común que puede ser utilizada por todos los módulos.

---

## No es responsabilidad

Persona no representa:

- un contrato;
- una oportunidad comercial;
- un empleado;
- un cliente activo;
- un expediente.

Esos conceptos pertenecen a otras entidades del dominio.

---

## Relaciones

Una Persona puede:

- convertirse en Cliente;
- convertirse en Empleado;
- generar una Oportunidad Comercial;
- abrir Expedientes;
- tener Actividades;
- tener Compromisos;
- participar en múltiples procesos.

La identidad permanece constante durante todo el ciclo de vida.

---

## Principios

Nunca deberán existir dos Personas representando al mismo individuo.

Los distintos módulos agregan relaciones sobre una Persona existente.

Nunca crean una nueva identidad.

---

## Ciclo de vida

Una Persona puede evolucionar de la siguiente manera.

Persona

↓

Oportunidad Comercial

↓

Cliente

↓

Cliente Histórico

Sin perder nunca su identidad original.

---

## Regla principal

La Persona representa "quién es".

Los demás conceptos representan "qué relación tiene con la empresa".
