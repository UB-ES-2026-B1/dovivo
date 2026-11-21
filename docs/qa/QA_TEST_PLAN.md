# Plan de pruebas QA — Dovivo

> Responsable de QA: Laia Casas · Versión del documento: 0.1 · Fecha: 2026-11-10
> Fuentes: `README.md`, `Dovivo_PO.docx` (backlog y criterios de aceptación del PO) y `package.json`.

## 1. Contexto del proyecto

Dovivo es un portal web para **comprar, alquilar y publicar viviendas**. El objetivo es entregar un **MVP desplegado el 15 de diciembre de 2026**, en el que:

- un **visitante** explora y busca anuncios y ve fichas,
- un **usuario registrado** publica anuncios y contacta con anunciantes,

**Criterios de éxito del MVP (PO):**

1. Todas las historias **Must** cumplen la Definition of Done y están aceptadas por el PO.
2. El flujo completo (registro, publicar, buscar, ver ficha, contactar, moderar) funciona de extremo a extremo en **staging**.
3. Cada sprint termina con demo funcional y retrospectiva.

**Regla del PO sobre bugs:** se reserva ~15 % de la capacidad de cada sprint para bugs y deuda técnica, y **no se cierra un sprint con bugs críticos abiertos**.

## 2. Análisis técnico (del README)

| Aspecto            | Descripción                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------- |
| Tipo de aplicación | Aplicación web full-stack (monolito modular)                                                            |
| Framework          | Next.js 15 (App Router, React 19), TypeScript estricto                                                  |
| API                | tRPC 11 + validación con zod (`/api/trpc`), no es REST clásica                                          |
| Datos              | PostgreSQL 17 con Prisma 6                                                                              |
| Autenticación      | Auth.js / NextAuth v5 (email + contraseña con bcrypt; Discord opcional y sin botón en `/login`)         |
| Estilos            | Tailwind CSS 4                                                                                          |
| Tests existentes   | Vitest (`pnpm test`); Playwright «planificado»                                                          |
| CI                 | GitHub Actions: formato, lint, typecheck, tests y build en Ubuntu, Windows y macOS, más build de Docker |
| Rutas principales  | `/`, `/buy`, `/rent`, `/properties/[id]`, `/publish`, `/register`, `/login`, `/api/health`              |
| Cómo ejecutar      | `pnpm install` → `pnpm db:up` → `pnpm db:migrate` → `pnpm db:seed` → `pnpm dev`                         |
| Ramas              | `feat/…` → PR + review + CI verde → `development` → PR de release → `main` (protegida)                  |

**Puntos del diseño que afectan a QA:**

- Los precios se guardan en **céntimos** (riesgo de errores de conversión).
- Borrar un anuncio es un **borrado lógico** (`deletedAt`): hay que comprobar que desaparece de listado, búsqueda y ficha.
- Estados del anuncio: `DRAFT → PUBLISHED → RESERVED → CLOSED`: solo los publicados deben ser públicos.
- Roles `USER`, `AGENT`, `ADMIN`; un usuario bloqueado tiene `blockedAt`.
- Hay límites de intentos en registro/login por IP, que dependen de `TRUSTED_PROXY_COUNT`.
- Existe un `pnpm db:bench` que falla si el p95 de `property.list` supera 300 ms.

## 3. Alcance

**Dentro del alcance (las 13 historias Must, todas con criterios de aceptación definidos, más pruebas de sistema y despliegue):**

| Historia                            | Prioridad | Sprint | Casos de prueba | Nº  |
| ----------------------------------- | --------- | ------ | --------------- | --- |
| US-01 · Registro                    | Must      | S1     | TC-001 a TC-007 | 7   |
| US-02 · Inicio de sesión            | Must      | S1     | TC-008 a TC-013 | 6   |
| US-03 · Cerrar sesión               | Must      | S1     | TC-014 a TC-016 | 3   |
| US-04 · Consultar perfil            | Must      | S1     | TC-017 a TC-019 | 3   |
| US-05 · Editar perfil               | Must      | S1     | TC-020 a TC-023 | 4   |
| US-09 · Explorar la oferta          | Must      | S1     | TC-024 a TC-029 | 6   |
| US-12 · Ficha del anuncio           | Must      | S1     | TC-030 a TC-036 | 7   |
| US-10 · Búsqueda con filtros        | Must      | S2     | TC-037 a TC-048 | 12  |
| US-17 · Publicar anuncio            | Must      | S2     | TC-049 a TC-055 | 7   |
| US-18 · Subir fotos                 | Must      | S2     | TC-056 a TC-063 | 8   |
| US-21 · Contactar con el anunciante | Must      | S2     | TC-064 a TC-069 | 6   |
| US-14 · Favoritos                   | Must      | S3     | TC-070 a TC-075 | 6   |
| US-19 · Gestionar mis anuncios      | Must      | S3     | TC-076 a TC-080 | 5   |

**Alcance por sprint**

| Sprint | Fechas          | Qué se prueba                                                                    |
| ------ | --------------- | -------------------------------------------------------------------------------- |
| S1     | 20 oct – 10 nov | US-01 a US-05, US-09, US-12 (cuentas, perfil, explorar, ficha)                   |
| S2     | 10 – 24 nov     | US-10, US-17, US-18, US-21 (búsqueda, publicar, fotos, contacto)                 |
| S3     | 24 nov – 15 dic | US-14, US-19, Should/Could si hay capacidad, regresión total, QA final y staging |

**Fuera del alcance (Should/Could/Post):** US-06 (verificar email), US-07 (eliminar cuenta), US-08 (recuperar contraseña), US-11 (ordenar y paginar), US-13 (mapa), US-15, US-16, US-20, US-22 a US-25 (chatbot, chats, alertas). Se añadirán casos si entran en un sprint.

> Nota: el PO las marca como Could/Should y algunas como «S3\*» (candidatas si hay tiempo). Los criterios de aceptación del PO solo están definidos para las Must.

## 4. Tipos de pruebas y prioridad

| Tipo                        | Prioridad | Aplica   | Justificación en Dovivo                                                                    |
| --------------------------- | --------- | -------- | ------------------------------------------------------------------------------------------ |
| Funcional                   | Muy alta  | Sí       | Cada criterio de aceptación de las historias Must.                                         |
| Sistema (extremo a extremo) | Muy alta  | Sí       | Criterio de éxito del MVP: flujo completo en staging.                                      |
| Aceptación                  | Muy alta  | Sí       | La DoD exige que QA valide los tests de aceptación y el PO acepte.                         |
| Seguridad                   | Alta      | Sí       | Contraseñas, sesiones, permisos entre usuarios, subida de ficheros, XSS.                   |
| Integración                 | Alta      | Sí       | tRPC ↔ Prisma ↔ PostgreSQL; servicio de emails (US-21).                                    |
| Exploratoria                | Alta      | Sí       | Formularios, filtros y subida de fotos.                                                    |
| Usabilidad                  | Alta      | Sí       | Mensajes de error, estados vacíos, 404 amigable.                                           |
| Rendimiento                 | Media     | Parcial  | Solo el requisito de «menos de 3 s con 1.000 anuncios» (`pnpm db:seed` + `pnpm db:bench`). |
| Compatibilidad              | Media     | Parcial  | Chrome, Firefox, Edge y móvil.                                                             |
| Accesibilidad               | Baja      | Opcional | Lighthouse/axe en listado, ficha y formularios.                                            |

## 5. Herramientas y entorno

| Herramienta                                       | Uso                                                            | Estado                  |
| ------------------------------------------------- | -------------------------------------------------------------- | ----------------------- |
| GitHub Issues + Projects                          | Bugs y seguimiento de tareas QA                                | Esencial                |
| Chrome DevTools                                   | Pruebas manuales, red, modo móvil                              | Esencial                |
| Prisma Studio (`pnpm db:studio`)                  | Comprobar datos en la BD (hash de contraseña, borrado lógico…) | Esencial                |
| Datos de prueba (`pnpm db:seed`, `pnpm db:reset`) | 1.000 anuncios y BD limpia                                     | Esencial                |
| Vitest (ya instalado)                             | Tests de validadores (`src/lib/validators`) y routers          | Recomendado             |
| GitHub Actions (`ci.yml`, ya configurado)         | Comprobar que el CI está verde en cada PR                      | Esencial                |
| Playwright (planificado en el README)             | Automatizar flujos críticos (login, publicar, buscar)          | Recomendado desde S2/S3 |
| k6                                                | Carga                                                          | (existe ya `db:bench`)  |

**Entorno de pruebas:** local con Docker (`pnpm db:up`) y **staging** (a confirmar con DevOps). Registrar siempre el commit probado.

## 6. Responsabilidades

| Tarea                                                  | Responsable                                 |
| ------------------------------------------------------ | ------------------------------------------- |
| Estrategia de pruebas, casos y validación de historias | QA                                          |
| Datos de prueba (T-15)                                 | QA + Backend                                |
| Tests unitarios y de integración (Vitest)              | Backend / Frontend (QA revisa la cobertura) |
| Entorno de pruebas / staging y CI                      | DevOps                                      |
| Aceptación final de las historias                      | Product Owner                               |
| Corrección de bugs                                     | Equipo de desarrollo                        |

## 7. Criterios de aceptación y salida (alineados con la DoD del PO)

Una historia se da por validada por QA cuando:

- [ ] Todos sus casos Alta y Crítica están en **Passed**.
- [ ] No tiene bugs abiertos de severidad **Crítica** o **Alta**.
- [ ] Se ha pasado la regresión relacionada y el CI está en verde.
- [ ] Está desplegada y probada en **staging**.
- [ ] El PO la acepta.

**Un sprint no se cierra con bugs críticos abiertos.**

## 8. Gestión de defectos

- Cada defecto es una **GitHub Issue** de tipo Bug, vinculada a la historia (`US-XX`) y al caso (`TC-XXX`).
- Etiquetas: `bug`, `QA`, `testing`, `regression`, `security`, `critical`, `needs-retest`.
- El estado se sigue en el GitHub Project del equipo; el resumen vive en [BUG_REPORT.md](BUG_REPORT.md).
- Severidad y prioridad como en [BUG_REPORT.md](BUG_REPORT.md).

## 9. Planificación de QA

| Momento            | Trabajo de QA                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| S2 (10–24 nov)     | Casos de US-10, US-17, US-18, US-21; probar el email (T-16); empezar Playwright en login y publicar |
| S3 (24 nov–15 dic) | US-14 y US-19; regresión completa; staging; compatibilidad; informe final                           |
| 15 dic             | Entrega del MVP e informe final de QA                                                               |
