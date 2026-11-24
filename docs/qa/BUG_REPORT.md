# Resumen de defectos — Dovivo

> Cada defecto se documenta en detalle en una **GitHub Issue**. Este archivo es el resumen y su estado.
> Regla del PO: los bugs y la deuda técnica son ítems del backlog (tipo *Bug* o *Tech debt*), con ~15 % de la capacidad de cada sprint, y **no se cierra un sprint con bugs críticos abiertos**.

## Resumen

| ID | Título | Historia | Caso | Severidad | Prioridad | Estado | Issue | Retest |
|---|---|---|---|---|---|---|---|---|
| BUG-001 | _[Título breve]_ | US-XX | TC-XXX | Crítica / Alta / Media / Baja | Alta / Media / Baja | Abierto / En corrección / Corregido / Cerrado | #_[n]_ | Pendiente / OK / KO |

## Escala de severidad

| Severidad | Descripción | Ejemplo en Dovivo |
|---|---|---|
| Crítica | Compromete la seguridad o rompe el funcionamiento principal | Un usuario puede editar o borrar el anuncio de otro; la contraseña se guarda en texto plano |
| Alta | Impide una funcionalidad Must | No se puede iniciar sesión o publicar un anuncio |
| Media | La función falla pero hay alternativa | Un filtro secundario no funciona |
| Baja | Impacto reducido o visual | Texto desalineado en la ficha |

> **Severidad** = impacto. **Prioridad** = urgencia. Los bugs Críticos bloquean el cierre del sprint.

## Plantilla de Issue en GitHub

```markdown
**Título:** [BUG] Descripción breve del problema

**Historia:** US-XX · **Caso de prueba:** TC-XXX

**Descripción:**
Qué ocurre y dónde (ruta, p. ej. /publish).

**Pasos para reproducir:**
1. ...
2. ...
3. ...

**Resultado esperado:**
...

**Resultado obtenido:**
...

**Entorno:**
- Entorno: local / staging
- Navegador y versión:
- Sistema operativo:
- Rama / commit:

**Severidad:** Crítica / Alta / Media / Baja
**Prioridad:** Alta / Media / Baja
**Evidencia:** captura o vídeo adjunto (sin datos personales reales)
```

## Ejemplo

- **Título:** [BUG] Un usuario puede eliminar el anuncio de otro llamando directamente a la API
- **Historia / caso:** US-19 / TC-0xx
- **Pasos:** 1) Iniciar sesión como usuario A. 2) Copiar el ID de un anuncio del usuario B. 3) Llamar al procedimiento de borrado con ese ID.
- **Esperado:** `FORBIDDEN`; el anuncio no se elimina.
- **Obtenido:** el anuncio se elimina.
- **Severidad:** Crítica (acceso no autorizado).

## Distribución de defectos

| Severidad | Detectados | Solucionados | Pendientes |
|---|---|---|---|
| Crítica | | | |
| Alta | | | |
| Media | | | |
| Baja | | | |

## Defectos por sprint

| Sprint | Detectados | Cerrados al final del sprint | Críticos abiertos al cierre |
|---|---|---|---|
| S1 | | | |
| S2 | | | |
| S3 | | | |
