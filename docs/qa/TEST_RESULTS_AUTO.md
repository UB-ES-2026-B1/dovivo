# Resultados automáticos de las pruebas — Dovivo

> **Archivo generado por `e2e/md-reporter.ts`. No editar a mano: se sobrescribe en cada ejecución de Playwright.**
> Acumula los resultados de ejecuciones anteriores (`QA_RESET=1 pnpm test:e2e` para empezar de cero).
> Los casos «Manual» se anotan a mano en [TEST_RESULTS.md](TEST_RESULTS.md).

## Última ejecución

| Campo | Valor |
|---|---|
| Fecha | 2026-11-21 08:50 |
| Rama | test/e2e-playwright |
| Commit | 8dab945 |
| Entorno | https://dovivo-staging-ahbzg9e9ghb8enb3.francecentral-01.azurewebsites.net |
| Sistema | darwin · Node v22.23.4 |

## Resumen

| Métrica | Valor |
|---|---|
| Casos diseñados (TEST_CASES.md) | 86 |
| Con test automático | 78 |
| Ejecutados con resultado (Passed + Failed) | 57 |
| ✅ Passed | 18 |
| ❌ Failed | 39 |
| ⏭️ Pendiente (fixme/skip) | 20 |
| ⏳ Automáticos sin ejecutar | 1 |
| 🖐️ Manuales (a rellenar a mano) | 8 |
| % de superación (Passed ÷ ejecutados) | 31.6 % |

## Resultados por caso

| ID | Historia | Prueba | Estado | Tests OK | Última ejecución | Notas |
|---|---|---|---|---|---|---|
| TC-001 | US-01 | Registro correcto | ✅ Passed | 1/1 | 2026-11-21 08:50 |  |
| TC-002 | US-01 | Email ya registrado | ✅ Passed | 1/1 | 2026-11-21 08:50 |  |
| TC-003 | US-01 | Contraseña de 7 caracteres | ✅ Passed | 1/1 | 2026-11-21 08:50 |  |
| TC-004 | US-01 | Contraseña de exactamente 8 caracteres | ✅ Passed | 1/1 | 2026-11-21 08:50 |  |
| TC-005 | US-01 | Contraseña cifrada en la base de datos | 🖐️ Manual |  |  | Sin test automático |
| TC-006 | US-01 | Campos vacíos o email con formato inválido | ✅ Passed | 1/1 | 2026-11-21 08:50 |  |
| TC-007 | US-01 | Email duplicado con distintas mayúsculas | 🖐️ Manual |  |  | Sin test automático |
| TC-008 | US-02 | Login correcto | ⏭️ Pendiente (fixme/skip) | 0/1 | 2026-11-21 08:50 | Test marcado como pendiente en el código |
| TC-009 | US-02 | Contraseña incorrecta | ⏭️ Pendiente (fixme/skip) | 0/1 | 2026-11-21 08:50 | Test marcado como pendiente en el código |
| TC-010 | US-02 | Email inexistente | ⏭️ Pendiente (fixme/skip) | 0/1 | 2026-11-21 08:50 | Test marcado como pendiente en el código |
| TC-011 | US-02 | La sesión se mantiene al recargar | ⏭️ Pendiente (fixme/skip) | 0/1 | 2026-11-21 08:50 | Test marcado como pendiente en el código |
| TC-012 | US-02 | Página privada sin sesión | ⏭️ Pendiente (fixme/skip) | 0/1 | 2026-11-21 08:50 | Test marcado como pendiente en el código |
| TC-013 | US-02 | Intentos de login repetidos | 🖐️ Manual |  |  | Sin test automático |
| TC-014 | US-03 | Opción de cerrar sesión visible | ✅ Passed | 1/1 | 2026-11-21 08:50 |  |
| TC-015 | US-03 | Tras cerrar sesión vuelvo a ser visitante | ✅ Passed | 1/1 | 2026-11-21 08:50 |  |
| TC-016 | US-03 | Botón Atrás tras cerrar sesión | ✅ Passed | 1/1 | 2026-11-21 08:50 |  |
| TC-017 | US-04 | Ver mi perfil | ✅ Passed | 1/1 | 2026-11-21 08:45 |  |
| TC-018 | US-04 | Solo mi propio perfil | ⏭️ Pendiente (fixme/skip) | 0/1 | 2026-11-21 08:45 | Test marcado como pendiente en el código |
| TC-019 | US-04 | Perfil sin sesión | ✅ Passed | 1/1 | 2026-11-21 08:45 |  |
| TC-020 | US-05 | Modificar el nombre | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-021 | US-05 | Añadir o cambiar teléfono | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-022 | US-05 | Campo inválido | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-023 | US-05 | Cambios visibles al instante | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-024 | US-09 | Listado visible sin sesión | ✅ Passed | 1/1 | 2026-11-21 08:45 |  |
| TC-025 | US-09 | Contenido de cada tarjeta | ✅ Passed | 1/1 | 2026-11-21 08:45 |  |
| TC-026 | US-09 | Cambiar entre venta y alquiler | ✅ Passed | 1/1 | 2026-11-21 08:45 |  |
| TC-027 | US-09 | Sin anuncios | ⏭️ Pendiente (fixme/skip) | 0/1 | 2026-11-21 08:45 | Test marcado como pendiente en el código |
| TC-029 | US-09 | Anuncios no publicados o eliminados no aparecen | 🖐️ Manual |  |  | Sin test automático |
| TC-030 | US-12 | Contenido de la ficha | ❌ Failed | 0/1 | 2026-11-21 08:45 | Error: precio · expect(received).toMatch(expected) |
| TC-031 | US-12 | Anunciante y botón de contacto | ❌ Failed | 0/1 | 2026-11-21 08:45 | Error: precio · expect(received).toMatch(expected) |
| TC-032 | US-12 | Anuncio inexistente | ❌ Failed | 0/1 | 2026-11-21 08:45 | Error: expect(received).toBe(expected) // Object.is equality · Expected: 404 |
| TC-033 | US-12 | Anuncio eliminado | 🖐️ Manual |  |  | Sin test automático |
| TC-034 | US-12 | URL propia y compartible | ✅ Passed | 1/1 | 2026-11-21 08:45 |  |
| TC-035 | US-12 | Ficha visible para visitante | ❌ Failed | 0/1 | 2026-11-21 08:45 | Error: precio · expect(received).toMatch(expected) |
| TC-036 | US-12 | Precio mostrado correctamente | ⏭️ Pendiente (fixme/skip) | 0/1 | 2026-11-21 08:45 | Test marcado como pendiente en el código |
| TC-037 | US-10 | Filtrar por operación | ✅ Passed | 1/1 | 2026-11-21 08:45 |  |
| TC-038 | US-10 | Filtro de precio mínimo y máximo | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-039 | US-10 | Filtro de habitaciones | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-040 | US-10 | Filtro de m² | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-041 | US-10 | Filtro de tipo de inmueble | ⏭️ Pendiente (fixme/skip) | 0/1 | 2026-11-21 08:45 | Test marcado como pendiente en el código |
| TC-042 | US-10 | Búsqueda por ubicación | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-043 | US-10 | Combinar filtros y ver contador | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-044 | US-10 | Actualización sin recarga completa | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-045 | US-10 | Sin resultados | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-046 | US-10 | Filtros en la URL | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-047 | US-10 | Valores incoherentes | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-048 | US-10 | Caracteres especiales en la ubicación | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-049 | US-17 | Publicar anuncio válido | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-050 | US-17 | Falta un campo obligatorio | ❌ Failed | 0/6 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-051 | US-17 | Valores inválidos | ❌ Failed | 0/4 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-052 | US-17 | Publicar sin sesión | ✅ Passed | 1/1 | 2026-11-21 08:45 |  |
| TC-053 | US-17 | Venta y alquiler | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-054 | US-17 | Doble clic en Publicar | ⏭️ Pendiente (fixme/skip) | 0/1 | 2026-11-21 08:45 | Test marcado como pendiente en el código |
| TC-055 | US-17 | HTML o script en la descripción | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-056 | US-18 | Subir foto válida | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-057 | US-18 | Máximo de 15 fotos | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-058 | US-18 | Foto de más de 5 MB | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-059 | US-18 | Foto de exactamente 5 MB | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-060 | US-18 | Formato no válido | ❌ Failed | 0/3 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-061 | US-18 | Elegir foto de portada | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-062 | US-18 | Eliminar foto | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-063 | US-18 | Fotos optimizadas | ⏭️ Pendiente (fixme/skip) | 0/1 | 2026-11-21 08:45 | Test marcado como pendiente en el código |
| TC-064 | US-21 | Enviar mensaje al anunciante | ⏭️ Pendiente (fixme/skip) | 0/1 | 2026-11-21 08:50 | Test marcado como pendiente en el código |
| TC-065 | US-21 | Email al anunciante con enlace | ⏭️ Pendiente (fixme/skip) | 0/1 | 2026-11-21 08:50 | Test marcado como pendiente en el código |
| TC-066 | US-21 | Mensaje vacío | ⏭️ Pendiente (fixme/skip) | 0/1 | 2026-11-21 08:50 | Test marcado como pendiente en el código |
| TC-067 | US-21 | Escribir a mi propio anuncio | ⏭️ Pendiente (fixme/skip) | 0/1 | 2026-11-21 08:50 | Test marcado como pendiente en el código |
| TC-068 | US-21 | Contactar sin sesión | ✅ Passed | 1/1 | 2026-11-21 08:50 |  |
| TC-069 | US-21 | Mensaje largo y caracteres especiales | ⏭️ Pendiente (fixme/skip) | 0/1 | 2026-11-21 08:50 | Test marcado como pendiente en el código |
| TC-070 | US-14 | Añadir y quitar favorito desde el listado | ⏭️ Pendiente (fixme/skip) | 0/1 | 2026-11-21 08:50 | Test marcado como pendiente en el código |
| TC-071 | US-14 | Añadir y quitar favorito desde la ficha | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-072 | US-14 | Lista de favoritos | ⏭️ Pendiente (fixme/skip) | 0/1 | 2026-11-21 08:50 | Test marcado como pendiente en el código |
| TC-073 | US-14 | Favorito eliminado o no disponible | ⏭️ Pendiente (fixme/skip) | 0/1 | 2026-11-21 08:45 | Test marcado como pendiente en el código |
| TC-074 | US-14 | Favorito sin sesión | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-075 | US-14 | Favoritos privados | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-076 | US-19 | Listado de mis anuncios con estado | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-077 | US-19 | Editar todos los campos | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-078 | US-19 | Eliminar con confirmación | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-079 | US-19 | Anuncio eliminado desaparece de la búsqueda | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-080 | US-19 | No tocar anuncios de otros | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-081 | Sistema, no funcionales y despliegue | Flujo completo de extremo a extremo | ❌ Failed | 0/1 | 2026-11-21 08:45 | Test timeout of 60000ms exceeded. |
| TC-082 | Sistema, no funcionales y despliegue | Endpoint de salud | ✅ Passed | 1/1 | 2026-11-21 08:45 |  |
| TC-083 | Sistema, no funcionales y despliegue | Diseño responsive en móvil | ⏳ Sin ejecutar |  |  |  |
| TC-084 | Sistema, no funcionales y despliegue | Compatibilidad de navegadores | 🖐️ Manual |  |  | Sin test automático |
| TC-085 | Sistema, no funcionales y despliegue | Despliegue con Docker | 🖐️ Manual |  |  | Sin test automático |
| TC-086 | Sistema, no funcionales y despliegue | Flujo completo en staging | ⏭️ Pendiente (fixme/skip) | 0/1 | 2026-11-21 08:45 | Test marcado como pendiente en el código |
| TC-087 | Sistema, no funcionales y despliegue | Accesibilidad básica | 🖐️ Manual |  |  | Sin test automático |

## Fallos

Antes de abrir una Issue, comprueba si el fallo es del test (selector o texto incorrecto) o un defecto real de la aplicación.

### TC-020 · Modificar el nombre

- **TC-020 / TC-023 modificar el nombre se ve al instante y tras recargar** (`e2e/profile.spec.ts`): Test timeout of 60000ms exceeded.

### TC-021 · Añadir o cambiar teléfono

- **TC-021 añadir y cambiar teléfono** (`e2e/profile.spec.ts`): Test timeout of 60000ms exceeded.

### TC-022 · Campo inválido

- **TC-022 un campo inválido muestra error y no guarda nada** (`e2e/profile.spec.ts`): Test timeout of 60000ms exceeded.

### TC-023 · Cambios visibles al instante

- **TC-020 / TC-023 modificar el nombre se ve al instante y tras recargar** (`e2e/profile.spec.ts`): Test timeout of 60000ms exceeded.

### TC-030 · Contenido de la ficha

- **TC-030 / TC-031 / TC-035 la ficha es visible sin sesión y muestra datos y botón de contacto** (`e2e/listings.spec.ts`): Error: precio · expect(received).toMatch(expected)

### TC-031 · Anunciante y botón de contacto

- **TC-030 / TC-031 / TC-035 la ficha es visible sin sesión y muestra datos y botón de contacto** (`e2e/listings.spec.ts`): Error: precio · expect(received).toMatch(expected)

### TC-032 · Anuncio inexistente

- **TC-032 un anuncio inexistente devuelve una 404 amigable** (`e2e/listings.spec.ts`): Error: expect(received).toBe(expected) // Object.is equality · Expected: 404

### TC-035 · Ficha visible para visitante

- **TC-030 / TC-031 / TC-035 la ficha es visible sin sesión y muestra datos y botón de contacto** (`e2e/listings.spec.ts`): Error: precio · expect(received).toMatch(expected)

### TC-038 · Filtro de precio mínimo y máximo

- **TC-038 filtro de precio mínimo y máximo** (`e2e/search.spec.ts`): Test timeout of 60000ms exceeded.

### TC-039 · Filtro de habitaciones

- **TC-039 filtro de habitaciones actualiza la URL y no rompe la página** (`e2e/search.spec.ts`): Test timeout of 60000ms exceeded.

### TC-040 · Filtro de m²

- **TC-040 filtro de m² actualiza la URL y no rompe la página** (`e2e/search.spec.ts`): Test timeout of 60000ms exceeded.

### TC-042 · Búsqueda por ubicación

- **TC-042 filtro de ubicación actualiza la URL y no rompe la página** (`e2e/search.spec.ts`): Test timeout of 60000ms exceeded.

### TC-043 · Combinar filtros y ver contador

- **TC-043 combinar filtros y ver el número de resultados** (`e2e/search.spec.ts`): Test timeout of 60000ms exceeded.

### TC-044 · Actualización sin recarga completa

- **TC-044 los resultados se actualizan sin recargar la página completa** (`e2e/search.spec.ts`): Test timeout of 60000ms exceeded.

### TC-045 · Sin resultados

- **TC-045 sin resultados sugiere relajar los filtros** (`e2e/search.spec.ts`): Test timeout of 60000ms exceeded.

### TC-046 · Filtros en la URL

- **TC-046 los filtros quedan en la URL y la búsqueda es compartible** (`e2e/search.spec.ts`): Test timeout of 60000ms exceeded.

### TC-047 · Valores incoherentes

- **TC-047 valores incoherentes no rompen la aplicación** (`e2e/search.spec.ts`): Test timeout of 60000ms exceeded.

### TC-048 · Caracteres especiales en la ubicación

- **TC-048 caracteres especiales en la ubicación no ejecutan código ni rompen la página** (`e2e/search.spec.ts`): Test timeout of 60000ms exceeded.

### TC-049 · Publicar anuncio válido

- **TC-049 un anuncio válido se publica y aparece en el listado** (`e2e/publish.spec.ts`): Test timeout of 60000ms exceeded.

### TC-050 · Falta un campo obligatorio

- **TC-050 falta el campo obligatorio «price»: no se publica y se indica el error** (`e2e/publish.spec.ts`): Test timeout of 60000ms exceeded.
- **TC-050 falta el campo obligatorio «area»: no se publica y se indica el error** (`e2e/publish.spec.ts`): Test timeout of 60000ms exceeded.
- **TC-050 falta el campo obligatorio «rooms»: no se publica y se indica el error** (`e2e/publish.spec.ts`): Test timeout of 60000ms exceeded.
- **TC-050 falta el campo obligatorio «bathrooms»: no se publica y se indica el error** (`e2e/publish.spec.ts`): Test timeout of 60000ms exceeded.
- **TC-050 falta el campo obligatorio «address»: no se publica y se indica el error** (`e2e/publish.spec.ts`): Test timeout of 60000ms exceeded.
- **TC-050 falta el campo obligatorio «description»: no se publica y se indica el error** (`e2e/publish.spec.ts`): Test timeout of 60000ms exceeded.

### TC-051 · Valores inválidos

- **TC-051 valor inválido (precio 0) se rechaza** (`e2e/publish.spec.ts`): Test timeout of 60000ms exceeded.
- **TC-051 valor inválido (precio negativo) se rechaza** (`e2e/publish.spec.ts`): Test timeout of 60000ms exceeded.
- **TC-051 valor inválido (m² negativos) se rechaza** (`e2e/publish.spec.ts`): Test timeout of 60000ms exceeded.
- **TC-051 valor inválido (habitaciones decimales) se rechaza** (`e2e/publish.spec.ts`): Test timeout of 60000ms exceeded.

### TC-053 · Venta y alquiler

- **TC-053 se puede publicar venta y alquiler** (`e2e/publish.spec.ts`): Test timeout of 60000ms exceeded.

### TC-055 · HTML o script en la descripción

- **TC-055 HTML o script en la descripción se muestra como texto y no se ejecuta** (`e2e/publish.spec.ts`): Test timeout of 60000ms exceeded.

### TC-056 · Subir foto válida

- **TC-056 se pueden subir una foto JPG y una PNG válidas** (`e2e/publish.spec.ts`): Test timeout of 60000ms exceeded.

### TC-057 · Máximo de 15 fotos

- **TC-057 máximo 15 fotos: la 16.ª se rechaza** (`e2e/publish.spec.ts`): Test timeout of 60000ms exceeded.

### TC-058 · Foto de más de 5 MB

- **TC-058 foto de más de 5 MB se rechaza con mensaje claro** (`e2e/publish.spec.ts`): Test timeout of 60000ms exceeded.

### TC-059 · Foto de exactamente 5 MB

- **TC-059 foto de exactamente 5 MB se acepta** (`e2e/publish.spec.ts`): Test timeout of 60000ms exceeded.

### TC-060 · Formato no válido

- **TC-060 formato no válido (GIF) se rechaza** (`e2e/publish.spec.ts`): Test timeout of 60000ms exceeded.
- **TC-060 formato no válido (PDF) se rechaza** (`e2e/publish.spec.ts`): Test timeout of 60000ms exceeded.
- **TC-060 formato no válido (.exe renombrado a .jpg) se rechaza** (`e2e/publish.spec.ts`): Test timeout of 60000ms exceeded.

### TC-061 · Elegir foto de portada

- **TC-061 elegir foto de portada** (`e2e/publish.spec.ts`): Test timeout of 60000ms exceeded.

### TC-062 · Eliminar foto

- **TC-062 eliminar una foto** (`e2e/publish.spec.ts`): Test timeout of 60000ms exceeded.

### TC-071 · Añadir y quitar favorito desde la ficha

- **TC-071 añadir favorito desde la ficha** (`e2e/favourites.spec.ts`): Test timeout of 60000ms exceeded.

### TC-074 · Favorito sin sesión

- **TC-074 un visitante que pulsa favorito es invitado a iniciar sesión** (`e2e/favourites.spec.ts`): Test timeout of 60000ms exceeded.

### TC-075 · Favoritos privados

- **TC-075 los favoritos son privados de cada usuario** (`e2e/favourites.spec.ts`): Test timeout of 60000ms exceeded.

### TC-076 · Listado de mis anuncios con estado

- **TC-076 mi listado muestra mis anuncios con su estado** (`e2e/my-listings.spec.ts`): Test timeout of 60000ms exceeded.

### TC-077 · Editar todos los campos

- **TC-077 puedo editar los campos de un anuncio mío** (`e2e/my-listings.spec.ts`): Test timeout of 60000ms exceeded.

### TC-078 · Eliminar con confirmación

- **TC-078 / TC-079 eliminar pide confirmación y el anuncio desaparece de la búsqueda** (`e2e/my-listings.spec.ts`): Test timeout of 60000ms exceeded.

### TC-079 · Anuncio eliminado desaparece de la búsqueda

- **TC-078 / TC-079 eliminar pide confirmación y el anuncio desaparece de la búsqueda** (`e2e/my-listings.spec.ts`): Test timeout of 60000ms exceeded.

### TC-080 · No tocar anuncios de otros

- **TC-080 un usuario no puede editar ni eliminar el anuncio de otro** (`e2e/my-listings.spec.ts`): Test timeout of 60000ms exceeded.

### TC-081 · Flujo completo de extremo a extremo

- **TC-081 flujo completo: registro → publicar con foto → otro usuario lo ve y contacta → cerrar sesión** (`e2e/system.spec.ts`): Test timeout of 60000ms exceeded.

## Tests sin caso en TEST_CASES.md

| Test | Archivo | Estado | Última ejecución |
|---|---|---|---|
| sin scroll horizontal en / | e2e/system.spec.ts | passed | 2026-11-21 08:45 |
| sin scroll horizontal en /buy | e2e/system.spec.ts | passed | 2026-11-21 08:45 |
| sin scroll horizontal en /login | e2e/system.spec.ts | passed | 2026-11-21 08:45 |
| sin scroll horizontal en /register | e2e/system.spec.ts | passed | 2026-11-21 08:45 |

