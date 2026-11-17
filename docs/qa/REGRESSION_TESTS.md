# Pruebas de regresión — Dovivo

> Conjunto mínimo que se repite tras cambios o correcciones relevantes. Se ejecuta **antes de cada PR de release a `main`** (fin de sprint) y cuando se toque login, listado, ficha, publicación o el esquema de Prisma.

## Cuándo ejecutarla

- Tras corregir un bug: retesting + los casos relacionados de esta tabla.
- Al final de cada sprint, antes de la demo y del PR de release.
- Tras cambios en `src/server/auth`, `src/server/api/routers`, `prisma/schema.prisma` o migraciones.
- Antes de la entrega del 15 de diciembre (regresión completa en staging).

## Casos de regresión

| ID | Caso | Historia | Origen | Automatizable | Herramienta sugerida |
|---|---|---|---|---|---|
| REG-001 | Registro correcto | US-01 | TC-001 | Sí | Playwright |
| REG-002 | Email ya registrado | US-01 | TC-002 | Sí | Playwright |
| REG-003 | Login correcto | US-02 | TC-008 | Sí | Playwright |
| REG-004 | Error genérico con credenciales incorrectas | US-02 | TC-009 | Sí | Playwright |
| REG-005 | Página privada sin sesión redirige al login | US-02 | TC-012 | Sí | Playwright |
| REG-006 | Cerrar sesión y botón Atrás | US-03 | TC-016 | Sí | Playwright |
| REG-007 | Ver y editar perfil | US-05 | TC-020 | Sí | Playwright |
| REG-008 | Listado visible sin sesión | US-09 | TC-024 | Sí | Playwright |
| REG-009 | Cambio venta/alquiler | US-09 | TC-026 | Sí | Playwright |
| REG-010 | Ficha del anuncio completa | US-12 | TC-030 | Sí | Playwright |
| REG-011 | Ficha 404 amigable | US-12 | TC-032 | Sí | Playwright |
| REG-012 | Filtros combinados | US-10 | TC-043 | Sí | Playwright |
| REG-013 | Filtros en la URL | US-10 | TC-046 | Sí | Playwright |
| REG-014 | Publicar anuncio válido | US-17 | TC-049 | Sí | Playwright |
| REG-015 | Publicar sin sesión | US-17 | TC-052 | Sí | Playwright |
| REG-016 | Subir foto válida | US-18 | TC-056 | Sí | Playwright |
| REG-017 | Foto de más de 5 MB rechazada | US-18 | TC-058 | Sí | Playwright |
| REG-018 | Enviar mensaje al anunciante | US-21 | TC-064 | Sí | Playwright + buzón de pruebas |
| REG-019 | No tocar anuncios de otros | US-19 | TC-080 | Sí | Vitest (router) / Playwright |
| REG-020 | Flujo completo de extremo a extremo | SYS | TC-081 | Sí | Playwright |

## Registro de ejecuciones

| Fecha | Motivo (cambio / bug / release) | Commit | Casos ejecutados | Resultado | Notas |
|---|---|---|---|---|---|
| _[AAAA-MM-DD]_ | _[Cierre S1]_ | _[hash]_ | REG-001 a REG-020 | | |

## Automatización recomendada

1. **Vitest (ya instalado):** validadores de `src/lib/validators` (contraseña mínima de 8, email, precio, límites de fotos) y routers tRPC con permisos (`protectedProcedure`, propiedad del anuncio).
2. **Playwright (planificado en el README):** empezar por login/registro y el flujo publicar → buscar → ficha. Añadir un job al CI cuando haya 3-4 specs estables.
3. **CI:** el workflow `ci.yml` ya ejecuta lint, typecheck, tests y build en 3 sistemas; QA solo debe comprobar que está verde antes de aceptar una historia.

## Retesting vs. regresión

- **Retesting:** repetir exactamente la prueba que detectó el defecto.
- **Regresión:** probar el resto de funciones relacionadas para confirmar que la corrección no ha roto nada.
