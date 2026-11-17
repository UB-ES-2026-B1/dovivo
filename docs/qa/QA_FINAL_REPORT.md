# Informe final de QA — Dovivo

> Responsable de QA: _[nombre]_ · Fecha: _[AAAA-MM-DD]_ · Versión evaluada: _[commit / tag]_ · Entorno: _[staging]_

## 1. Resumen ejecutivo

_[Valoración general en 3-5 líneas: estado de calidad del MVP, principales riesgos y recomendación de entrega.]_

## 2. Alcance de las pruebas

- **Probado:** historias Must (US-01 a US-05, US-09, US-10, US-12, US-14, US-17, US-18, US-19, US-21) y flujo extremo a extremo.
- **No probado y motivo:** _[Should/Could/Post: US-06, 07, 08, 11, 13, 15, 16, 20, 22–25; moderación sin historia definida…]_

## 3. Criterios de éxito del MVP (PO)

- [ ] Todas las historias Must cumplen la Definition of Done y están aceptadas por el PO.
- [ ] El flujo completo (registro, publicar, buscar, ver ficha, contactar, moderar) funciona de extremo a extremo en staging.
- [ ] Cada sprint terminó con demo y retrospectiva.
- [ ] No hay bugs críticos abiertos.

## 4. Tipos de pruebas realizadas

| Tipo | Realizada | Herramienta | Comentarios |
|---|---|---|---|
| Funcional | | Manual / DevTools | |
| Integración | | Vitest / Prisma Studio | |
| Sistema (E2E) | | Manual / Playwright | |
| Regresión | | Playwright / manual | |
| Aceptación | | Manual con el PO | |
| Seguridad | | Manual / ZAP (local) | |
| Usabilidad | | Manual | |
| Exploratoria | | Manual | |
| Compatibilidad | | Chrome, Firefox, Edge | |
| Rendimiento | | `db:bench` / Lighthouse | |
| Accesibilidad | | Lighthouse / axe | |

## 5. Métricas

| Métrica | Valor |
|---|---|
| Casos diseñados | 87 |
| Casos ejecutados | |
| Superados | |
| Fallidos | |
| Bloqueados | |
| % de superación (superados ÷ ejecutados × 100) | |
| Bugs detectados / solucionados / pendientes | |
| Cobertura de requisitos (historias Must con al menos un caso ejecutado) | /13 |

### Cobertura por historia

| Historia | Prioridad | Casos | Passed | Failed | Blocked | Aceptada por el PO |
|---|---|---|---|---|---|---|
| US-01 · Registro | Must | 7 | | | | ☐ |
| US-02 · Inicio de sesión | Must | 6 | | | | ☐ |
| US-03 · Cerrar sesión | Must | 3 | | | | ☐ |
| US-04 · Consultar perfil | Must | 3 | | | | ☐ |
| US-05 · Editar perfil | Must | 4 | | | | ☐ |
| US-09 · Explorar la oferta | Must | 6 | | | | ☐ |
| US-12 · Ficha del anuncio | Must | 7 | | | | ☐ |
| US-10 · Búsqueda con filtros | Must | 12 | | | | ☐ |
| US-17 · Publicar anuncio | Must | 7 | | | | ☐ |
| US-18 · Subir fotos | Must | 8 | | | | ☐ |
| US-21 · Contactar con el anunciante | Must | 6 | | | | ☐ |
| US-14 · Favoritos | Must | 6 | | | | ☐ |
| US-19 · Gestionar mis anuncios | Must | 5 | | | | ☐ |

### Defectos por severidad

| Severidad | Detectados | Pendientes |
|---|---|---|
| Crítica | | |
| Alta | | |
| Media | | |
| Baja | | |

## 6. Defectos pendientes

| Issue | Título | Severidad | Motivo por el que sigue abierto |
|---|---|---|---|
| #_[n]_ | | | |

## 7. Limitaciones

_[Pruebas no realizadas, falta de tiempo, staging, emails, compatibilidad en Safari, etc. Un porcentaje alto de pruebas superadas no garantiza calidad si hay requisitos sin cubrir.]_

## 8. Conclusiones y recomendaciones

_[¿Está el MVP listo para entregarse? Qué mejorar en una siguiente fase.]_

## 9. Enlaces

- [Plan de pruebas](QA_TEST_PLAN.md) · [Casos](TEST_CASES.md) · [Resultados](TEST_RESULTS.md) · [Defectos](BUG_REPORT.md) · [Regresión](REGRESSION_TESTS.md)
