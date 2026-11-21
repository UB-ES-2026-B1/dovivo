# Casos de prueba — Dovivo

> Los casos salen de los criterios de aceptación de las historias **Must** del Product Owner (`Dovivo_PO.docx`), más casos de seguridad, límites y exploratorios.
> Estados: **Passed**, **Failed**, **Blocked**, **Not run**. Los resultados se registran en [TEST_RESULTS.md](TEST_RESULTS.md).

**Total de casos diseñados: 87**

## Datos y entorno de prueba

- Arrancar la app: `pnpm db:up` → `pnpm db:migrate` → `pnpm db:seed` → `pnpm dev` (http://localhost:3000).
- `pnpm db:seed` crea 1.000 anuncios de demostración; `pnpm db:reset` deja la BD limpia (útil para los casos de «sin anuncios»).
- Usuarios de prueba (crear con datos ficticios en `/register`): `qa.user1@example.com`, `qa.user2@example.com` (para probar permisos entre usuarios) y `qa.anunciante@example.com`.
- Usar siempre datos ficticios; no subir contraseñas ni claves a GitHub.
- Los anuncios se identifican en `/properties/[id]`.

## Plantilla de caso

| Campo              | Contenido |
| ------------------ | --------- |
| ID                 | TC-XXX    |
| Historia           | US-XX     |
| Precondiciones     | …         |
| Pasos              | 1. … 2. … |
| Resultado esperado | …         |
| Tipo / Prioridad   | …         |

---

## US-01 · Registro _(Sprint S1)_

| ID     | Prueba                                     | Pasos                                                                                  | Resultado esperado                                                                                           | Tipo                 | Prioridad |
| ------ | ------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------- | --------- |
| TC-001 | Registro correcto                          | Ir a /register. Introducir nombre, email nuevo y contraseña de 10 caracteres. Enviar.  | Se crea la cuenta y la sesión queda iniciada (la cabecera muestra al usuario; sigue iniciada tras recargar). | Funcional            | Alta      |
| TC-002 | Email ya registrado                        | Registrarse con un email que ya existe.                                                | Mensaje de error claro. No se crea ninguna cuenta nueva (comprobar en Prisma Studio).                        | Funcional            | Alta      |
| TC-003 | Contraseña de 7 caracteres                 | Registrarse con una contraseña de 7 caracteres.                                        | No se puede continuar; se indica el mínimo de 8 caracteres.                                                  | Funcional (límite)   | Alta      |
| TC-004 | Contraseña de exactamente 8 caracteres     | Registrarse con una contraseña de 8 caracteres.                                        | El registro se completa.                                                                                     | Funcional (límite)   | Media     |
| TC-005 | Contraseña cifrada en la base de datos     | Tras registrar un usuario, abrir Prisma Studio (`pnpm db:studio`) y mirar su registro. | La contraseña está almacenada como hash (bcrypt), nunca en texto plano.                                      | Seguridad            | Alta      |
| TC-006 | Campos vacíos o email con formato inválido | Enviar el formulario vacío; luego con `usuario@` como email.                           | Se muestran errores de validación por campo y no se crea la cuenta.                                          | Funcional (negativa) | Media     |
| TC-007 | Email duplicado con distintas mayúsculas   | Registrar `Test@mail.com` si ya existe `test@mail.com`.                                | Se trata como duplicado (o el comportamiento queda documentado).                                             | Exploratoria         | Media     |

## US-02 · Inicio de sesión _(Sprint S1)_

| ID     | Prueba                            | Pasos                                                 | Resultado esperado                                                                                                    | Tipo                  | Prioridad |
| ------ | --------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------- | --------- |
| TC-008 | Login correcto                    | Ir a /login. Introducir email y contraseña correctos. | Acceso permitido a la cuenta.                                                                                         | Funcional             | Alta      |
| TC-009 | Contraseña incorrecta             | Email válido con contraseña errónea.                  | Error genérico que no revela qué campo falla.                                                                         | Funcional / Seguridad | Alta      |
| TC-010 | Email inexistente                 | Email no registrado con cualquier contraseña.         | Mismo mensaje genérico que con contraseña incorrecta (no revela si el email existe).                                  | Seguridad             | Alta      |
| TC-011 | La sesión se mantiene al recargar | Iniciar sesión y pulsar F5.                           | La sesión sigue activa.                                                                                               | Funcional             | Alta      |
| TC-012 | Página privada sin sesión         | Sin sesión, abrir `/publish` y la página de perfil.   | Redirección al login.                                                                                                 | Seguridad             | Alta      |
| TC-013 | Intentos de login repetidos       | Hacer 10 o más intentos fallidos seguidos.            | Se aplica el límite de intentos configurado. Nota: con `TRUSTED_PROXY_COUNT=0` los límites por IP están desactivados. | Seguridad             | Media     |

## US-03 · Cerrar sesión _(Sprint S1)_

| ID     | Prueba                                    | Pasos                                         | Resultado esperado                                                 | Tipo      | Prioridad |
| ------ | ----------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------ | --------- | --------- |
| TC-014 | Opción de cerrar sesión visible           | Iniciar sesión y revisar la cabecera.         | Hay una opción visible de cerrar sesión.                           | Funcional | Alta      |
| TC-015 | Tras cerrar sesión vuelvo a ser visitante | Cerrar sesión; abrir `/publish`.              | La cabecera muestra login/registro y `/publish` redirige al login. | Funcional | Alta      |
| TC-016 | Botón Atrás tras cerrar sesión            | Cerrar sesión y pulsar Atrás en el navegador. | No se ve ninguna página privada.                                   | Seguridad | Alta      |

## US-04 · Consultar perfil _(Sprint S1)_

| ID     | Prueba                | Pasos                                                              | Resultado esperado                                   | Tipo      | Prioridad |
| ------ | --------------------- | ------------------------------------------------------------------ | ---------------------------------------------------- | --------- | --------- |
| TC-017 | Ver mi perfil         | Iniciar sesión y abrir el perfil.                                  | Se ven nombre, email y datos de contacto correctos.  | Funcional | Alta      |
| TC-018 | Solo mi propio perfil | Intentar ver el perfil de otro usuario (cambiando la URL o el ID). | Acceso denegado o se sigue mostrando solo mi perfil. | Seguridad | Alta      |
| TC-019 | Perfil sin sesión     | Sin sesión, abrir la página de perfil.                             | Redirección al login.                                | Seguridad | Alta      |

## US-05 · Editar perfil _(Sprint S1)_

| ID     | Prueba                       | Pasos                                                         | Resultado esperado                                               | Tipo                 | Prioridad |
| ------ | ---------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------- | --------- |
| TC-020 | Modificar el nombre          | Editar el nombre y guardar.                                   | El nombre se actualiza.                                          | Funcional            | Alta      |
| TC-021 | Añadir o cambiar teléfono    | Añadir un teléfono válido y guardar; luego cambiarlo.         | El teléfono se guarda y se actualiza.                            | Funcional            | Alta      |
| TC-022 | Campo inválido               | Dejar el nombre vacío o poner letras en el teléfono. Guardar. | Se muestra un error y no se guarda nada (ni los campos válidos). | Funcional (negativa) | Alta      |
| TC-023 | Cambios visibles al instante | Guardar un cambio y mirar la pantalla; después recargar.      | Los cambios se ven inmediatamente y persisten tras recargar.     | Funcional            | Media     |

## US-09 · Explorar la oferta _(Sprint S1)_

| ID     | Prueba                                          | Pasos                                                           | Resultado esperado                                           | Tipo                 | Prioridad |
| ------ | ----------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------ | -------------------- | --------- |
| TC-024 | Listado visible sin sesión                      | Sin sesión, abrir la home, /buy y /rent.                        | Se ve un listado de anuncios de venta y de alquiler.         | Funcional            | Alta      |
| TC-025 | Contenido de cada tarjeta                       | Revisar varias tarjetas del listado.                            | Cada una muestra foto, precio, ubicación, m² y habitaciones. | Funcional            | Alta      |
| TC-026 | Cambiar entre venta y alquiler                  | Alternar entre venta y alquiler.                                | Solo se muestran anuncios de la operación elegida.           | Funcional            | Alta      |
| TC-027 | Sin anuncios                                    | Con la BD vacía, abrir el listado.                              | Mensaje informativo (sin error ni pantalla en blanco).       | Funcional (negativa) | Media     |
| TC-029 | Anuncios no publicados o eliminados no aparecen | Tener un anuncio DRAFT y otro con borrado lógico (`deletedAt`). | No aparecen en el listado público.                           | Funcional            | Media     |

## US-12 · Ficha del anuncio _(Sprint S1)_

| ID     | Prueba                         | Pasos                                                      | Resultado esperado                                                                   | Tipo                 | Prioridad |
| ------ | ------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------------------- | --------- |
| TC-030 | Contenido de la ficha          | Abrir la ficha de un anuncio (`/properties/[id]`).         | Se ven galería, precio, operación, m², habitaciones, baños, descripción y ubicación. | Funcional            | Alta      |
| TC-031 | Anunciante y botón de contacto | Revisar la ficha.                                          | Se ve quién es el anunciante y un botón para contactarle.                            | Funcional            | Alta      |
| TC-032 | Anuncio inexistente            | Abrir `/properties/id-que-no-existe`.                      | Página 404 amigable.                                                                 | Funcional (negativa) | Alta      |
| TC-033 | Anuncio eliminado              | Abrir la URL de un anuncio eliminado.                      | Página 404 amigable.                                                                 | Funcional (negativa) | Alta      |
| TC-034 | URL propia y compartible       | Copiar la URL y abrirla en una ventana privada.            | Muestra el mismo anuncio.                                                            | Funcional            | Media     |
| TC-035 | Ficha visible para visitante   | Sin sesión, abrir una ficha.                               | Se ve completa, sin exigir login.                                                    | Funcional            | Alta      |
| TC-036 | Precio mostrado correctamente  | Comparar el precio guardado (en céntimos) con el mostrado. | El importe mostrado es correcto (sin errores de factor 100 ni redondeos).            | Funcional            | Media     |

## US-10 · Búsqueda con filtros _(Sprint S2)_

| ID     | Prueba                                | Pasos                                                               | Resultado esperado                                                        | Tipo                 | Prioridad |
| ------ | ------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------- | --------- |
| TC-037 | Filtrar por operación                 | Elegir compra y luego alquiler.                                     | Solo salen anuncios de esa operación.                                     | Funcional            | Alta      |
| TC-038 | Filtro de precio mínimo y máximo      | Aplicar mín., máx. y ambos, incluidos valores límite.               | Solo salen anuncios dentro del rango (límites incluidos).                 | Funcional (límite)   | Alta      |
| TC-039 | Filtro de habitaciones                | Filtrar por número de habitaciones.                                 | Resultados coherentes con el filtro.                                      | Funcional            | Alta      |
| TC-040 | Filtro de m²                          | Filtrar por superficie.                                             | Resultados coherentes con el filtro.                                      | Funcional            | Alta      |
| TC-041 | Filtro de tipo de inmueble            | Filtrar por tipo (piso, casa, habitación…).                         | Solo salen anuncios del tipo elegido.                                     | Funcional            | Alta      |
| TC-042 | Búsqueda por ubicación                | Buscar por ciudad y por barrio.                                     | Resultados de la ubicación indicada.                                      | Funcional            | Alta      |
| TC-043 | Combinar filtros y ver contador       | Combinar 3 o más filtros.                                           | Los resultados cumplen todos los filtros y se ve el número de resultados. | Funcional            | Alta      |
| TC-044 | Actualización sin recarga completa    | Cambiar un filtro y observar la pestaña Network.                    | Los resultados se actualizan sin recargar toda la página.                 | Funcional            | Media     |
| TC-045 | Sin resultados                        | Aplicar filtros imposibles.                                         | Mensaje que sugiere relajar los filtros.                                  | Funcional (negativa) | Alta      |
| TC-046 | Filtros en la URL                     | Aplicar filtros, copiar la URL y abrirla en otra pestaña; recargar. | La búsqueda se reproduce con los mismos filtros.                          | Funcional            | Alta      |
| TC-047 | Valores incoherentes                  | Precio mínimo mayor que el máximo; valores negativos o texto.       | Error o resultado vacío controlado, sin fallo de la aplicación.           | Exploratoria         | Media     |
| TC-048 | Caracteres especiales en la ubicación | Buscar `' " <script>` y emojis.                                     | Sin errores ni ejecución de código; resultado vacío o controlado.         | Seguridad            | Media     |

## US-17 · Publicar anuncio _(Sprint S2)_

| ID     | Prueba                          | Pasos                                                                                                           | Resultado esperado                                              | Tipo                 | Prioridad |
| ------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------- | --------- |
| TC-049 | Publicar anuncio válido         | Con sesión, ir a /publish y rellenar operación, tipo, precio, m², habitaciones, baños, dirección y descripción. | El anuncio se publica y aparece en el listado y en la búsqueda. | Funcional            | Alta      |
| TC-050 | Falta un campo obligatorio      | Dejar sin rellenar cada campo obligatorio, uno por uno.                                                         | No se publica y se indica el error de cada campo.               | Funcional (negativa) | Alta      |
| TC-051 | Valores inválidos               | Precio 0 o negativo, m² negativos, habitaciones decimales.                                                      | Se rechazan con mensaje de error.                               | Funcional (negativa) | Alta      |
| TC-052 | Publicar sin sesión             | Sin sesión, abrir `/publish`; intentar llamar al procedimiento tRPC de creación.                                | Redirección al login en la web y `UNAUTHORIZED` en la API.      | Seguridad            | Alta      |
| TC-053 | Venta y alquiler                | Publicar un anuncio de venta y otro de alquiler.                                                                | Cada uno aparece en su sección.                                 | Funcional            | Alta      |
| TC-054 | Doble clic en Publicar          | Pulsar Publicar dos veces rápido.                                                                               | Se crea un único anuncio.                                       | Exploratoria         | Media     |
| TC-055 | HTML o script en la descripción | Escribir `<script>alert(1)</script>` en la descripción.                                                         | Se muestra como texto, sin ejecutarse.                          | Seguridad            | Alta      |

## US-18 · Subir fotos _(Sprint S2)_

| ID     | Prueba                   | Pasos                                                                                           | Resultado esperado                                             | Tipo                  | Prioridad |
| ------ | ------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | --------------------- | --------- |
| TC-056 | Subir foto válida        | Subir una foto JPG y otra PNG de menos de 5 MB.                                                 | Se suben y se muestran.                                        | Funcional             | Alta      |
| TC-057 | Máximo de 15 fotos       | Subir 15 fotos y luego intentar una 16.ª.                                                       | Las 15 se aceptan; la 16.ª se rechaza con mensaje claro.       | Funcional (límite)    | Alta      |
| TC-058 | Foto de más de 5 MB      | Subir una foto de más de 5 MB.                                                                  | Se rechaza con mensaje claro.                                  | Funcional (negativa)  | Alta      |
| TC-059 | Foto de exactamente 5 MB | Subir una foto de 5 MB.                                                                         | Se acepta (límite).                                            | Funcional (límite)    | Media     |
| TC-060 | Formato no válido        | Subir un GIF, un PDF y un `.exe` renombrado a `.jpg`.                                           | Se rechazan con mensaje claro.                                 | Seguridad / Funcional | Alta      |
| TC-061 | Elegir foto de portada   | Marcar una foto como portada.                                                                   | La portada se muestra en el listado.                           | Funcional             | Alta      |
| TC-062 | Eliminar foto            | Eliminar una foto (y la portada).                                                               | Desaparece; si era la portada, el comportamiento es coherente. | Funcional             | Media     |
| TC-063 | Fotos optimizadas        | Comparar el peso de la imagen mostrada en listado y ficha con el original (DevTools → Network). | Se sirven versiones optimizadas.                               | Rendimiento           | Media     |

## US-21 · Contactar con el anunciante _(Sprint S2)_

| ID     | Prueba                                | Pasos                                                               | Resultado esperado                                                                            | Tipo                 | Prioridad |
| ------ | ------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------- | --------- |
| TC-064 | Enviar mensaje al anunciante          | Con sesión, abrir la ficha de un anuncio ajeno y enviar un mensaje. | Se envía y se muestra confirmación.                                                           | Funcional            | Alta      |
| TC-065 | Email al anunciante con enlace        | Tras enviar un mensaje, revisar el email del anunciante.            | Recibe el mensaje por email con enlace al anuncio (depende del servicio de emails, T-16).     | Integración          | Alta      |
| TC-066 | Mensaje vacío                         | Enviar vacío y solo con espacios.                                   | No se envía; se indica el error.                                                              | Funcional (negativa) | Alta      |
| TC-067 | Escribir a mi propio anuncio          | Abrir la ficha de un anuncio mío.                                   | No puedo enviarme mensajes (botón oculto o bloqueado).                                        | Funcional (negativa) | Alta      |
| TC-068 | Contactar sin sesión                  | Sin sesión, pulsar Contactar.                                       | Se invita a iniciar sesión (el criterio solo define el caso con sesión: confirmar con el PO). | Funcional            | Media     |
| TC-069 | Mensaje largo y caracteres especiales | Enviar un mensaje muy largo y con emojis o comillas.                | Se envía o se rechaza con un límite claro, sin errores.                                       | Exploratoria         | Baja      |

## US-14 · Favoritos _(Sprint S3)_

| ID     | Prueba                                    | Pasos                                                             | Resultado esperado                      | Tipo      | Prioridad |
| ------ | ----------------------------------------- | ----------------------------------------------------------------- | --------------------------------------- | --------- | --------- |
| TC-070 | Añadir y quitar favorito desde el listado | Con sesión, marcar y desmarcar el favorito en una tarjeta.        | El cambio se refleja y persiste.        | Funcional | Alta      |
| TC-071 | Añadir y quitar favorito desde la ficha   | Repetir desde la ficha.                                           | Mismo comportamiento que en el listado. | Funcional | Alta      |
| TC-072 | Lista de favoritos                        | Abrir la lista de favoritos del perfil.                           | Aparecen todos mis favoritos.           | Funcional | Alta      |
| TC-073 | Favorito eliminado o no disponible        | Eliminar o cambiar el estado de un anuncio favorito.              | Se muestra indicado como no disponible. | Funcional | Media     |
| TC-074 | Favorito sin sesión                       | Sin sesión, pulsar el corazón.                                    | Se invita a iniciar sesión.             | Funcional | Alta      |
| TC-075 | Favoritos privados                        | Con dos usuarios, comprobar que no se ven los favoritos del otro. | Cada usuario solo ve los suyos.         | Seguridad | Media     |

## US-19 · Gestionar mis anuncios _(Sprint S3)_

| ID     | Prueba                                      | Pasos                                                                                        | Resultado esperado                                  | Tipo      | Prioridad |
| ------ | ------------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------- | --------- |
| TC-076 | Listado de mis anuncios con estado          | Con sesión, abrir Mis anuncios.                                                              | Se ven solo mis anuncios, con su estado.            | Funcional | Alta      |
| TC-077 | Editar todos los campos                     | Editar cada campo de un anuncio mío y guardar.                                               | Los cambios se guardan y se ven en la ficha.        | Funcional | Alta      |
| TC-078 | Eliminar con confirmación                   | Pulsar Eliminar; cancelar; volver a pulsar y confirmar.                                      | Cancelar no elimina; confirmar sí elimina.          | Funcional | Alta      |
| TC-079 | Anuncio eliminado desaparece de la búsqueda | Eliminar un anuncio y buscarlo.                                                              | No aparece en listado ni búsqueda; la ficha da 404. | Funcional | Alta      |
| TC-080 | No tocar anuncios de otros                  | Intentar editar o eliminar un anuncio ajeno (por la interfaz y llamando a la API con su ID). | Se deniega (`FORBIDDEN` o `UNAUTHORIZED`).          | Seguridad | Crítica   |

## Sistema, no funcionales y despliegue

| ID     | Prueba                              | Pasos                                                                                            | Resultado esperado                                          | Tipo           | Prioridad |
| ------ | ----------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | -------------- | --------- |
| TC-081 | Flujo completo de extremo a extremo | Registrarse, publicar un anuncio con fotos, buscarlo, abrir la ficha, contactar y cerrar sesión. | Todo el flujo funciona sin errores.                         | Sistema        | Alta      |
| TC-082 | Endpoint de salud                   | Abrir `/api/health`.                                                                             | Responde OK y comprueba la conexión a la BD.                | Integración    | Media     |
| TC-083 | Diseño responsive en móvil          | Con DevTools en modo móvil, recorrer listado, ficha, login y publicar.                           | Se ve y se usa correctamente.                               | Usabilidad     | Media     |
| TC-084 | Compatibilidad de navegadores       | Repetir el flujo principal en Chrome, Firefox y Edge (y Safari si hay Mac).                      | Comportamiento equivalente.                                 | Compatibilidad | Media     |
| TC-085 | Despliegue con Docker               | Ejecutar `docker compose up --build`.                                                            | `db`, `migrate` y `app` arrancan; la app responde en :3000. | Sistema        | Media     |
| TC-086 | Flujo completo en staging           | Repetir el flujo de extremo a extremo en el entorno de staging.                                  | Funciona igual que en local (criterio de éxito del MVP).    | Aceptación     | Alta      |
| TC-087 | Accesibilidad básica                | Pasar Lighthouse y axe por listado, ficha y formularios.                                         | Sin errores críticos de accesibilidad.                      | Accesibilidad  | Baja      |

## Pruebas exploratorias sugeridas

- Pulsar botones varias veces seguidas y actualizar la página durante una operación.
- Usar el botón Atrás/Adelante en mitad de un flujo (registro, publicar).
- Abrir la app en dos pestañas con la misma sesión y cerrar sesión en una.
- Probar con textos muy largos, emojis, comillas y caracteres Unicode en todos los campos.
- Pérdida de conexión durante la subida de fotos.
- Comprobar que los mensajes de error de la API (tRPC) no filtran información interna.
